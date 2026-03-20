import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Camera, CheckCircle, XCircle, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerificationStatus } from "@/hooks/useAttendance";

interface FaceVerificationProps {
  status: VerificationStatus;
  errorMessage: string | null;
  onVerify: (capturedImageBase64: string) => Promise<boolean>;
  onRetry: () => void;
}

export const FaceVerification = ({
  status,
  errorMessage,
  onVerify,
  onRetry,
}: FaceVerificationProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(
        "Unable to access camera. Please grant camera permission and try again."
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (status === "success" || status === "failed") {
      stopCamera();
    }
  }, [status, stopCamera]);

  const captureImage = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  const handleVerify = useCallback(async () => {
    const imageData = captureImage();
    if (!imageData) {
      setCameraError("Failed to capture image. Please try again.");
      return;
    }
    await onVerify(imageData);
  }, [captureImage, onVerify]);

  const handleRetry = () => {
    onRetry();
    startCamera();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Face Verification</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Step 1 of 2 • Identity Verification
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Camera Preview */}
          <div className="relative aspect-[4/3] bg-muted rounded-2xl overflow-hidden">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                <p className="text-sm text-muted-foreground">{cameraError}</p>
                <Button variant="outline" onClick={startCamera} className="mt-4">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Camera
                </Button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* Face guide overlay */}
                {status === "pending" && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-56 border-4 border-dashed border-primary/50 rounded-[40%] relative">
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-primary whitespace-nowrap">
                        Align your face here
                      </div>
                    </div>
                  </div>
                )}

                {/* Verifying overlay */}
                {status === "verifying" && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                    <p className="font-medium">Verifying face...</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Comparing with your profile photo
                    </p>
                  </div>
                )}

                {/* Success overlay */}
                {status === "success" && (
                  <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-sm flex flex-col items-center justify-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 10 }}
                    >
                      <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
                    </motion.div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Face Verified
                    </p>
                  </div>
                )}

                {/* Failed overlay */}
                {status === "failed" && (
                  <div className="absolute inset-0 bg-destructive/20 backdrop-blur-sm flex flex-col items-center justify-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 10 }}
                    >
                      <XCircle className="w-16 h-16 text-destructive mb-4" />
                    </motion.div>
                    <p className="font-semibold text-destructive">
                      Verification Failed
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Instructions */}
          {status === "pending" && !cameraError && (
            <div className="bg-muted/50 rounded-xl p-4">
              <h4 className="font-medium mb-2">Tips for successful verification:</h4>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Ensure your face is well-lit
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Remove glasses or face coverings if possible
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Look directly at the camera
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  Keep your face within the guide frame
                </li>
              </ul>
            </div>
          )}

          {/* Error message */}
          {errorMessage && status === "failed" && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-xl border border-destructive/20">
              <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {status === "pending" && !cameraError && (
              <Button onClick={handleVerify} className="flex-1 h-12" size="lg">
                <Camera className="w-5 h-5 mr-2" />
                Capture & Verify
              </Button>
            )}

            {status === "failed" && (
              <Button onClick={handleRetry} variant="outline" className="flex-1 h-12" size="lg">
                <RefreshCw className="w-5 h-5 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
