import { motion } from "framer-motion";
import { CheckCircle, Camera, MapPin, Clock, Calendar, Shield, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocationData } from "@/hooks/useAttendance";
import { format } from "date-fns";

interface AttendanceConfirmationProps {
  locationData: LocationData | null;
  onConfirm: () => void;
}

export const AttendanceConfirmation = ({
  locationData,
  onConfirm,
}: AttendanceConfirmationProps) => {
  const currentTime = new Date();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
        <CardHeader className="pb-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 10, delay: 0.2 }}
            className="mx-auto p-4 bg-emerald-500/20 rounded-full mb-4 w-fit"
          >
            <CheckCircle className="w-12 h-12 text-emerald-500" />
          </motion.div>
          <CardTitle className="text-2xl text-emerald-700 dark:text-emerald-400">
            Verification Complete
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            All security checks passed successfully
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-lg px-6 py-2">
              ✓ Present
            </Badge>
          </div>

          {/* Verification Summary */}
          <div className="bg-background/80 rounded-2xl p-5 space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Verification Summary
            </h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <Camera className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-medium">Face Verification</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Verified</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-medium">Location Verification</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600">
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
              <p className="text-sm text-muted-foreground">Time</p>
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
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600"
            size="lg"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Confirm Attendance
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};
