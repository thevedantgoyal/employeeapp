import { motion } from "framer-motion";
import { 
  CheckCircle, 
  Clock, 
  Camera, 
  MapPin, 
  AlertCircle,
  Fingerprint,
  LogOut,
  Timer
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AttendanceRecord } from "@/hooks/useAttendance";
import { format } from "date-fns";

interface TodayStatusProps {
  record: AttendanceRecord | null;
  onMarkAttendance: () => void;
  onMarkCheckOut?: () => void;
  workingDuration?: string;
  isCheckedOut?: boolean;
  /** When true, show Check-Out option even if record is still loading after check-in */
  todayMarked?: boolean;
  /** Fallback check-in time when record is not yet loaded (e.g. right after check-in API) */
  fallbackCheckInTime?: string | null;
}

export const TodayStatus = ({ 
  record, 
  onMarkAttendance, 
  onMarkCheckOut,
  workingDuration,
  isCheckedOut,
  todayMarked = false,
  fallbackCheckInTime = null,
}: TodayStatusProps) => {
  const today = format(new Date(), "EEEE, MMMM dd, yyyy");

  // Checked out state
  if (record && record.checkOutTime) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-full">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Session Complete
                  </h3>
                  <p className="text-sm text-muted-foreground">{today}</p>
                </div>
              </div>
              <Badge className="bg-primary hover:bg-primary/90">Checked Out</Badge>
            </div>

            {/* Session Timeline */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="bg-background/60 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs">Check-In</span>
                </div>
                <p className="text-base font-semibold text-emerald-600">{record.checkInTime}</p>
              </div>
              <div className="bg-background/60 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="text-xs">Check-Out</span>
                </div>
                <p className="text-base font-semibold text-primary">{record.checkOutTime}</p>
              </div>
              <div className="bg-background/60 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                  <Timer className="w-3.5 h-3.5" />
                  <span className="text-xs">Duration</span>
                </div>
                <p className="text-base font-semibold">{record.totalHoursWorked}</p>
              </div>
            </div>

            {/* Verification indicators */}
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-primary/20">
              <div className="bg-emerald-500/10 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Check-In Verification</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-emerald-500/20 rounded">
                      <Camera className="w-3 h-3 text-emerald-600" />
                    </div>
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">Face ✓</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-emerald-500/20 rounded">
                      <MapPin className="w-3 h-3 text-emerald-600" />
                    </div>
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">Location ✓</span>
                  </div>
                </div>
              </div>
              <div className="bg-primary/10 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Check-Out Verification</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-primary/20 rounded">
                      <Camera className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-xs">Face ✓</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-primary/20 rounded">
                      <MapPin className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-xs">Location ✓</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1 mt-3 text-xs text-muted-foreground">
              <Fingerprint className="w-3 h-3" />
              {record.verificationMethod}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Checked in, not checked out — show active session with check-out CTA
  if ((record?.checkInTime && !record?.checkOutTime) || (todayMarked && !isCheckedOut)) {
    const displayCheckInTime = record?.checkInTime ?? fallbackCheckInTime ?? "—";
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 rounded-full">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                    Checked In
                  </h3>
                  <p className="text-sm text-muted-foreground">{today}</p>
                </div>
              </div>
              <Badge className="bg-emerald-500 hover:bg-emerald-600">Active Session</Badge>
            </div>

            {/* Session info */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-background/60 rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Check-In Time</span>
                </div>
                <p className="text-lg font-semibold">{displayCheckInTime}</p>
              </div>
              <div className="bg-background/60 rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Timer className="w-4 h-4" />
                  <span className="text-sm">Working Since</span>
                </div>
                <p className="text-lg font-semibold font-mono text-primary">
                  {workingDuration || "00:00:00"}
                </p>
              </div>
            </div>

            {/* Check-in verification */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-emerald-500/20">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/20 rounded">
                  <Camera className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Face Verified
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/20 rounded">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Location Verified
                </span>
              </div>
              {record?.distance != null && (
                <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {record.distance}m
                </div>
              )}
            </div>

            {/* Check-Out CTA */}
            <Button 
              onClick={onMarkCheckOut} 
              className="w-full h-12 mt-5 bg-primary hover:bg-primary/90"
              size="lg"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Mark Check-Out
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-3">
              Check-Out requires camera and location verification to confirm identity and presence.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Not checked in
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-full">
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400">
                  Attendance Not Marked
                </h3>
                <p className="text-sm text-muted-foreground">{today}</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
              Pending
            </Badge>
          </div>

          <p className="text-muted-foreground mt-4 mb-6">
            You haven't marked your attendance for today. Mark now to record your presence.
          </p>

          <Button 
            onClick={onMarkAttendance} 
            className="w-full h-12"
            size="lg"
          >
            <Fingerprint className="w-5 h-5 mr-2" />
            Mark Attendance
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};
