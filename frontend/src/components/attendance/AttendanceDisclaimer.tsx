import { motion } from "framer-motion";
import { Camera, MapPin, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AttendanceDisclaimerProps {
  onProceed: () => void;
  disabled?: boolean;
}

export const AttendanceDisclaimer = ({ onProceed, disabled }: AttendanceDisclaimerProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Secure Attendance Verification</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">
            To ensure secure and fraud-resistant attendance tracking, this system requires
            two-factor verification: <strong>Face Recognition</strong> and{" "}
            <strong>Location Verification</strong>.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-background rounded-xl border">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <Camera className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Camera Access Required</h4>
                <p className="text-sm text-muted-foreground">
                  Your camera will be used to capture and verify your face against your
                  registered profile. This ensures only you can mark your attendance.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-background rounded-xl border">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Location Access Required</h4>
                <p className="text-sm text-muted-foreground">
                  Your current location will be verified against the office geo-fence to
                  confirm you are within the designated work area.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                Important Notice
              </p>
              <p className="text-muted-foreground">
                All verification attempts are logged for audit purposes. Please ensure you
                have good lighting and are within the office premises before proceeding.
              </p>
            </div>
          </div>

          <Button
            onClick={onProceed}
            disabled={disabled}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            I Understand, Proceed to Verification
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};
