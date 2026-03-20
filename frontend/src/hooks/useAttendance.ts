import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/api/db";
import { toast } from "sonner";
import { format } from "date-fns";

export type AttendanceStep = "disclaimer" | "face" | "location" | "confirmation";
export type VerificationStatus = "pending" | "verifying" | "success" | "failed";
export type FlowType = "checkin" | "checkout";

export interface AttendanceRecord {
  id: string;
  date: string;
  status: "present" | "absent" | "pending";
  checkInTime: string | null;
  checkOutTime: string | null;
  faceVerified: boolean;
  locationVerified: boolean;
  checkOutFaceVerified: boolean;
  checkOutLocationVerified: boolean;
  distance: number | null;
  checkOutDistance: number | null;
  verificationMethod: string;
  totalHoursWorked: string | null;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  distance: number;
  isWithinRadius: boolean;
}

const OFFICE_LOCATION = {
  latitude: 28.49726565449399,
  longitude: 77.1633343946611,
  radius: 70,
};

function calculateDuration(checkIn: string, checkOut: string): string {
  const [h1, m1, s1] = checkIn.split(":").map(Number);
  const [h2, m2, s2] = checkOut.split(":").map(Number);
  let totalSeconds = (h2 * 3600 + m2 * 60 + (s2 || 0)) - (h1 * 3600 + m1 * 60 + (s1 || 0));
  if (totalSeconds < 0) totalSeconds += 86400;
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Normalize DB date to local YYYY-MM-DD so it matches client "today" comparison. */
function normalizeDate(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  try {
    return format(new Date(value as string | number), "yyyy-MM-dd");
  } catch {
    return String(value);
  }
}

function dbRowToRecord(row: Record<string, unknown>): AttendanceRecord {
  const checkIn = row.check_in_time ? format(new Date(row.check_in_time as string | number), "HH:mm:ss") : null;
  const checkOut = row.check_out_time ? format(new Date(row.check_out_time as string | number), "HH:mm:ss") : null;
  return {
    id: row.id as string,
    date: normalizeDate(row.date),
    status: (row.status === "half_day" || row.status === "late" || row.status === "present") ? "present" : (row.status === "absent" ? "absent" : "pending"),
    checkInTime: checkIn,
    checkOutTime: checkOut,
    faceVerified: !!checkIn,
    locationVerified: !!checkIn,
    checkOutFaceVerified: !!checkOut,
    checkOutLocationVerified: !!checkOut,
    distance: row.location_lat != null && row.location_lng != null ? Math.round(calculateDistance(Number(row.location_lat), Number(row.location_lng), OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude)) : null,
    checkOutDistance: checkOut ? 0 : null,
    verificationMethod: checkIn ? "Face + Geo-fence" : "Not attempted",
    totalHoursWorked: checkIn && checkOut ? calculateDuration(checkIn, checkOut) : null,
  };
}

export const useAttendance = () => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<AttendanceStep>("disclaimer");
  const [activeFlowType, setActiveFlowType] = useState<FlowType>("checkin");
  const [faceStatus, setFaceStatus] = useState<VerificationStatus>("pending");
  const [locationStatus, setLocationStatus] = useState<VerificationStatus>("pending");
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [todayMarked, setTodayMarked] = useState(false);
  const [todayCheckedOut, setTodayCheckedOut] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workingDurationSeconds, setWorkingDurationSeconds] = useState(0);
  const [latestCheckInTime, setLatestCheckInTime] = useState<string | null>(null);
  const faceRetryCount = useRef(0);
  const faceVerificationTokenRef = useRef<string | null>(null);
  const MAX_FACE_RETRIES = 3;

  const officeRadius = OFFICE_LOCATION.radius;

  // Fetch attendance for history + today (no status filter — returns all: active and completed)
  const fetchHistory = useCallback(async () => {
    if (!user) return;
    const todayDate = format(new Date(), "yyyy-MM-dd");
    if (import.meta.env.DEV) {
      console.log("[Today Tab] Fetching attendance for date:", todayDate);
      console.log("[Today Tab] Query params: user_id, order=date, ascending=false, limit=30");
    }
    const { data, error } = await db
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(30);

    if (import.meta.env.DEV) {
      console.log("[Today Tab] Raw API response:", { rowCount: Array.isArray(data) ? data.length : 0, error: error?.message ?? null });
    }
    if (error) {
      console.error("Error fetching attendance:", error);
      return;
    }

    const records = (Array.isArray(data) ? data : []).map((row) => dbRowToRecord(row as Record<string, unknown>));
    if (import.meta.env.DEV && records.length > 0) {
      console.log("[Today Tab] Parsed attendance data (first 3 dates):", records.slice(0, 3).map((r) => ({ date: r.date, checkInTime: r.checkInTime, checkOutTime: r.checkOutTime })));
    }
    setAttendanceHistory(records);

    const todayRec = records.find((r) => r.date === todayDate);
    if (todayRec) {
      setTodayMarked(true);
      if (todayRec.checkOutTime) setTodayCheckedOut(true);
    } else {
      setTodayMarked(false);
      setTodayCheckedOut(false);
    }
    if (import.meta.env.DEV) {
      console.log("[Today Tab] Status value read:", todayRec ? (todayRec.checkOutTime ? "completed" : "checked-in") : "not-marked");
      console.log("[Today Tab] Deciding card to show based on:", todayRec ?? "no record for today");
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const getTodayAttendance = useCallback((): AttendanceRecord | null => {
    const today = format(new Date(), "yyyy-MM-dd");
    const rec = attendanceHistory.find((record) => record.date === today) || null;
    if (import.meta.env.DEV) {
      console.log("[Today Tab] Determining card to show...", "today:", today, "checkInTime:", rec?.checkInTime, "checkOutTime:", rec?.checkOutTime, "hasRecord:", !!rec);
    }
    return rec;
  }, [attendanceHistory]);

  // Live working duration counter (uses check-in time from today's record)
  useEffect(() => {
    const todayRecord = getTodayAttendance();
    if (!todayRecord?.checkInTime || todayRecord.checkOutTime) return;

    const [h, m, s] = todayRecord.checkInTime.split(":").map(Number);
    const checkInDate = new Date();
    checkInDate.setHours(h, m, s, 0);

    if (import.meta.env.DEV) {
      console.log("[Attendance] Timer initialized with:", todayRecord.checkInTime, "checkInDate:", checkInDate.toISOString());
    }

    const updateDuration = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - checkInDate.getTime()) / 1000);
      setWorkingDurationSeconds(Math.max(0, diff));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [getTodayAttendance]);

  const formattedWorkingDuration = useCallback(() => {
    const hours = Math.floor(workingDurationSeconds / 3600);
    const mins = Math.floor((workingDurationSeconds % 3600) / 60);
    const secs = workingDurationSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [workingDurationSeconds]);

  const startAttendanceFlow = useCallback(() => {
    faceVerificationTokenRef.current = null;
    setActiveFlowType("checkin");
    setCurrentStep("face");
    setFaceStatus("pending");
    setLocationStatus("pending");
    setLocationData(null);
    setErrorMessage(null);
    faceRetryCount.current = 0;
  }, []);

  const startCheckOutFlow = useCallback(() => {
    setActiveFlowType("checkout");
    setCurrentStep("face");
    setFaceStatus("pending");
    setLocationStatus("pending");
    setLocationData(null);
    setErrorMessage(null);
    faceRetryCount.current = 0;
  }, []);

  const verifyFaceWithBackend = useCallback(async (capturedImageBase64: string): Promise<boolean> => {
    if (faceRetryCount.current >= MAX_FACE_RETRIES) {
      setFaceStatus("failed");
      setErrorMessage("Maximum retry attempts reached. Please contact your administrator.");
      return false;
    }

    setFaceStatus("verifying");
    faceRetryCount.current += 1;

    try {
      const { data: sessionData } = await db.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setFaceStatus("failed");
        setErrorMessage("Session expired. Please log in again.");
        return false;
      }

      // Face verification: call backend if implemented, otherwise skip (not available)
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
      const response = await fetch(`${apiUrl}/attendance/verify-face`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          capturedImage: capturedImageBase64,
          timestamp: Date.now(),
        }),
      }).catch(() => null);

      const result = response ? await response.json().catch(() => ({})) : {};
      if (response?.ok && result.faceVerified === true) {
        faceVerificationTokenRef.current = result.verificationToken ?? null;
        setFaceStatus("success");
        setCurrentStep("location");
        return true;
      } else {
        setFaceStatus("failed");
        setErrorMessage(result.message || "Face verification failed. Please try again.");
        return false;
      }
    } catch (err) {
      console.error("Face verification error:", err);
      setFaceStatus("failed");
      setErrorMessage("Face verification service unavailable. Please try again.");
      return false;
    }
  }, []);

  const retryFaceVerification = useCallback(() => {
    if (faceRetryCount.current >= MAX_FACE_RETRIES) {
      setErrorMessage("Maximum retry attempts reached. Please contact your administrator.");
      return;
    }
    setFaceStatus("pending");
    setErrorMessage(null);
  }, []);

  const verifyLocation = useCallback(async (): Promise<boolean> => {
    setLocationStatus("verifying");

    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationStatus("failed");
        setErrorMessage("Geolocation is not supported by your browser.");
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const distance = calculateDistance(latitude, longitude, OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude);
          const isWithinRadius = distance <= OFFICE_LOCATION.radius;

          setLocationData({ latitude, longitude, accuracy, distance: Math.round(distance), isWithinRadius });

          setTimeout(() => {
            if (isWithinRadius) {
              setLocationStatus("success");
              setCurrentStep("confirmation");
              resolve(true);
            } else {
              setLocationStatus("failed");
              setErrorMessage(`You are ${Math.round(distance)}m away from the office. Please move within ${OFFICE_LOCATION.radius}m radius.`);
              resolve(false);
            }
          }, 1500);
        },
        (error) => {
          setLocationStatus("failed");
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setErrorMessage("Location permission denied. Please enable location access.");
              break;
            case error.POSITION_UNAVAILABLE:
              setErrorMessage("Location information unavailable.");
              break;
            case error.TIMEOUT:
              setErrorMessage("Location request timed out. Please try again.");
              break;
            default:
              setErrorMessage("An unknown error occurred while fetching location.");
          }
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  const confirmAttendance = useCallback(async () => {
    if (!user) return;

    const verificationToken = faceVerificationTokenRef.current;
    if (!verificationToken) {
      toast.error("Face Not Verified. Please complete face verification first.");
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
    const { data: sessionData } = await db.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      toast.error("Session expired. Please log in again.");
      return;
    }

    const response = await fetch(`${apiUrl}/attendance/check-in`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        verificationToken,
        location_lat: locationData?.latitude ?? null,
        location_lng: locationData?.longitude ?? null,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (import.meta.env.DEV) {
      console.log("[Attendance] Check-in API response:", result);
    }
    if (response.ok && result.data) {
      const row = result.data as Record<string, unknown>;
      const record = dbRowToRecord(row);
      if (import.meta.env.DEV) {
        console.log("[Attendance] checkInTime saved to state:", record.checkInTime);
        console.log("[Attendance] Timer will use checkInTime from optimistic record");
      }
      setLatestCheckInTime(record.checkInTime);
      setAttendanceHistory((prev) => {
        const today = format(new Date(), "yyyy-MM-dd");
        const rest = prev.filter((r) => r.date !== today);
        return [record, ...rest];
      });
      faceVerificationTokenRef.current = null;
      setTodayMarked(true);
      toast.success("Check-in recorded successfully!");
      fetchHistory();
      return;
    }

    const msg = result.error?.message || "Failed to save attendance";
    if (response.status === 403) {
      toast.error(result.error?.message || "Face Not Verified. Please Retry.");
      return;
    }
    if (response.status === 409) {
      toast.error("Already checked in for today");
      fetchHistory();
      return;
    }
    toast.error(msg);
  }, [user, locationData, fetchHistory]);

  const confirmCheckOut = useCallback(async () => {
    if (!user) return;

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
    const { data: sessionData } = await db.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      toast.error("Session expired. Please log in again.");
      return;
    }

    const response = await fetch(`${apiUrl}/attendance/check-out`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json().catch(() => ({}));
    if (response.ok && result.data) {
      const row = result.data as Record<string, unknown>;
      const updatedRecord = dbRowToRecord(row);
      if (import.meta.env.DEV) {
        console.log("[Attendance] Checkout confirmed, updating state to completed");
        console.log("[Attendance] New state after checkout:", { checkInTime: updatedRecord.checkInTime, checkOutTime: updatedRecord.checkOutTime, totalHoursWorked: updatedRecord.totalHoursWorked });
      }
      setAttendanceHistory((prev) => {
        const today = format(new Date(), "yyyy-MM-dd");
        const idx = prev.findIndex((r) => r.date === today);
        if (idx < 0) return [updatedRecord, ...prev];
        return prev.map((r, i) => (i === idx ? updatedRecord : r));
      });
      setTodayCheckedOut(true);
      toast.success("Check-out recorded successfully!");
      fetchHistory();
      return;
    }

    const msg = result.error?.message || "Failed to save check-out";
    if (response.status === 404) {
      toast.error("Check-in not found. You must check in before checking out.");
      fetchHistory();
      return;
    }
    toast.error(msg);
  }, [user, fetchHistory]);

  const resetFlow = useCallback(() => {
    faceVerificationTokenRef.current = null;
    setCurrentStep("disclaimer");
    setFaceStatus("pending");
    setLocationStatus("pending");
    setLocationData(null);
    setErrorMessage(null);
  }, []);

  return {
    currentStep,
    activeFlowType,
    faceStatus,
    locationStatus,
    locationData,
    todayMarked,
    todayCheckedOut,
    attendanceHistory,
    errorMessage,
    officeRadius,
    formattedWorkingDuration,
    startAttendanceFlow,
    startCheckOutFlow,
    verifyFaceWithBackend,
    retryFaceVerification,
    verifyLocation,
    confirmAttendance,
    confirmCheckOut,
    resetFlow,
    getTodayAttendance,
    latestCheckInTime,
    fetchHistory,
  };
};
