import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Smartphone, CheckCircle, Share, Plus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPage = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for successful install
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">App Installed!</h1>
          <p className="text-muted-foreground">
            CacheTask is now installed on your device.
          </p>
          <Button className="mt-6" onClick={() => window.location.href = "/"}>
            Open App
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-md mx-auto pt-12"
      >
        <motion.div variants={itemVariants} className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Smartphone className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Install CacheTask</h1>
          <p className="text-muted-foreground">
            Add CacheTask to your home screen for quick access
          </p>
        </motion.div>

        {deferredPrompt && !isIOS && (
          <motion.div variants={itemVariants}>
            <Button
              size="lg"
              className="w-full mb-6 gap-2"
              onClick={handleInstallClick}
            >
              <Download className="w-5 h-5" />
              Install App
            </Button>
          </motion.div>
        )}

        {isIOS && (
          <motion.div variants={itemVariants}>
            <Card className="mb-6 border-indigo-500/30 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Share className="w-5 h-5" />
                  Install on iPhone/iPad
                </CardTitle>
                <CardDescription>
                  Follow these steps to add CacheTask to your home screen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Tap the Share button</p>
                    <p className="text-sm text-muted-foreground">
                      Look for the <Share className="w-4 h-4 inline" /> icon at the bottom of Safari
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Scroll and tap "Add to Home Screen"</p>
                    <p className="text-sm text-muted-foreground">
                      Look for the <Plus className="w-4 h-4 inline" /> icon in the menu
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Tap "Add"</p>
                    <p className="text-sm text-muted-foreground">
                      Confirm by tapping Add in the top right corner
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!isIOS && !deferredPrompt && (
          <motion.div variants={itemVariants}>
            <Card className="mb-6 border-indigo-500/30 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MoreVertical className="w-5 h-5" />
                  Install on Android
                </CardTitle>
                <CardDescription>
                  Follow these steps to add CacheTask to your home screen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Tap the menu button</p>
                    <p className="text-sm text-muted-foreground">
                      Look for <MoreVertical className="w-4 h-4 inline" /> at the top right of Chrome
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Tap "Install app" or "Add to Home screen"</p>
                    <p className="text-sm text-muted-foreground">
                      This will add the app icon to your home screen
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Tap "Install"</p>
                    <p className="text-sm text-muted-foreground">
                      Confirm the installation
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Why install?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Quick access from your home screen
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Works offline
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Faster loading times
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Full-screen experience
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="mt-6 text-center">
          <Button variant="ghost" onClick={() => window.location.href = "/"}>
            Continue to App
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default InstallPage;
