import { motion } from "framer-motion";
import { CheckCircle, Camera, MapPin, Clock, Calendar, Shield, Fingerprint, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocationData, AttendanceRecord } from "@/hooks/useAttendance";
import { format } from "date-fns";

interface CheckOutConfirmationProps {
  locationData: LocationData | null;
  todayRecord: AttendanceRecord | null;
  /** Fallback when todayRecord is not yet loaded (e.g. from check-in API response) */
  fallbackCheckInTime?: string | null;
  onConfirm: () => void;
}

export const CheckOutConfirmation = ({
  locationData,
  todayRecord,
  onConfirm,
}: CheckOutConfirmationProps) => {
  const currentTime = new Date();

  const getDuration = () => {
    if (!todayRecord?.checkInTime) return "—";
    const [h1, m1, s1] = todayRecord.checkInTime.split(":").map(Number);
    const now = new Date();
    let totalSec = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) - (h1 * 3600 + m1 * 60 + s1);
    if (totalSec < 0) totalSec += 86400;
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
        <CardHeader className="pb-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 10, delay: 0.2 }}
            className="mx-auto p-4 bg-blue-500/20 rounded-full mb-4 w-fit"
          >
            <CheckCircle className="w-12 h-12 text-blue-500" />
          </motion.div>
          <CardTitle className="text-2xl text-blue-700 dark:text-blue-400">
            Check-Out Verification Complete
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            All security checks passed for check-out
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge className="bg-blue-500 hover:bg-blue-600 text-lg px-6 py-2">
              ✓ Ready to Check Out
            </Badge>
          </div>

          {/* Session Summary */}
          <div className="bg-background/80 rounded-2xl p-5 space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              Session Summary
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Check-In</p>
                <p className="font-semibold text-emerald-600">{checkInTime || "—"}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Check-Out</p>
                <p className="font-semibold text-blue-600">{format(currentTime, "HH:mm:ss")}</p>
              </div>
            </div>

            <div className="bg-primary/5 rounded-xl p-4 text-center border border-primary/10">
              <p className="text-xs text-muted-foreground mb-1">Total Working Duration</p>
              <p className="text-2xl font-bold text-primary">{getDuration()}</p>
            </div>
          </div>

          {/* Verification Summary */}
          <div className="bg-background/80 rounded-2xl p-5 space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Check-Out Verification
            </h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Camera className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium">Face Verification</span>
                </div>
                <div className="flex items-center gap-2 text-blue-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Verified</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <MapPin className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium">Location Verification</span>
                </div>
                <div className="flex items-center gap-2 text-blue-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {locationData?.distance}m from office
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <Calendar className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="font-semibold">{format(currentTime, "MMM dd, yyyy")}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <Clock className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Check-Out Time</p>
              <p className="font-semibold">{format(currentTime, "hh:mm:ss a")}</p>
            </div>
          </div>

          {/* Verification Method */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Fingerprint className="w-4 h-4" />
            <span>Verification Method: Face + Geo-fence</span>
          </div>

          {/* Confirm Button */}
          <Button
            onClick={onConfirm}
            className="w-full h-12 bg-blue-500 hover:bg-blue-600"
            size="lg"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Confirm Check-Out
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};
