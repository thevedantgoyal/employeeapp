import { useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, CheckCircle, XCircle, Loader2, Navigation, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerificationStatus, LocationData } from "@/hooks/useAttendance";
import { Badge } from "@/components/ui/badge";

interface LocationVerificationProps {
  status: VerificationStatus;
  locationData: LocationData | null;
  officeRadius: number;
  errorMessage: string | null;
  onVerify: () => Promise<boolean>;
}

export const LocationVerification = ({
  status,
  locationData,
  officeRadius,
  errorMessage,
  onVerify,
}: LocationVerificationProps) => {
  useEffect(() => {
    // Auto-start location verification when component mounts
    if (status === "pending") {
      onVerify();
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Location Verification</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Step 2 of 2 • Presence Verification
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Card */}
          <div className="relative bg-muted/50 rounded-2xl p-6 overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
              <div className="w-64 h-64 border-2 border-primary rounded-full" />
              <div className="absolute w-48 h-48 border-2 border-primary rounded-full" />
              <div className="absolute w-32 h-32 border-2 border-primary rounded-full" />
            </div>

            <div className="relative flex flex-col items-center text-center">
              {status === "pending" && (
                <>
                  <div className="p-4 bg-muted rounded-full mb-4">
                    <Navigation className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    Waiting to fetch your location...
                  </p>
                </>
              )}

              {status === "verifying" && (
                <>
                  <div className="p-4 bg-primary/10 rounded-full mb-4">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                  <p className="font-medium">Fetching your location...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please wait while we verify your position
                  </p>
                </>
              )}

              {status === "success" && locationData && (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 10 }}
                    className="p-4 bg-emerald-500/20 rounded-full mb-4"
                  >
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </motion.div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Location Verified
                  </p>
                  <Badge variant="secondary" className="mt-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    Inside Office Zone
                  </Badge>
                </>
              )}

              {status === "failed" && (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 10 }}
                    className="p-4 bg-destructive/20 rounded-full mb-4"
                  >
                    <XCircle className="w-8 h-8 text-destructive" />
                  </motion.div>
                  <p className="font-semibold text-destructive">
                    Location Check Failed
                  </p>
                  <Badge variant="secondary" className="mt-2 bg-destructive/10 text-destructive">
                    Outside Office Zone
                  </Badge>
                </>
              )}
            </div>
          </div>

          {/* Location Details */}
          {locationData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-background rounded-xl border">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Distance from Office</span>
                </div>
                <span className={`font-semibold ${
                  locationData.isWithinRadius ? "text-emerald-600" : "text-destructive"
                }`}>
                  {locationData.distance}m
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-background rounded-xl border">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-dashed border-muted-foreground rounded-full" />
                  <span className="text-sm font-medium">Office Radius</span>
                </div>
                <span className="font-semibold text-muted-foreground">
                  {officeRadius}m
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-background rounded-xl border">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Status</span>
                </div>
                <Badge
                  variant={locationData.isWithinRadius ? "default" : "destructive"}
                  className={locationData.isWithinRadius ? "bg-emerald-500" : ""}
                >
                  {locationData.isWithinRadius ? "Inside" : "Outside"}
                </Badge>
              </div>
            </div>
          )}

          {/* Error message */}
          {errorMessage && status === "failed" && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-xl border border-destructive/20">
              <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          {/* Retry button for failed state */}
          {status === "failed" && (
            <Button onClick={onVerify} variant="outline" className="w-full h-12" size="lg">
              <MapPin className="w-5 h-5 mr-2" />
              Check Location Again
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
