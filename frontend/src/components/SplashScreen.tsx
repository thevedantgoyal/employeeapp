import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase("hold"), 600);
    const exitTimer = setTimeout(() => setPhase("exit"), 2200);
    const completeTimer = setTimeout(onComplete, 2800);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== "exit" ? null : null}
      <motion.div
        key="splash"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === "exit" ? 0 : 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent overflow-hidden"
      >
        {/* Animated background circles */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 4, opacity: 0.08 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="absolute w-64 h-64 rounded-full bg-primary-foreground"
        />
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 3, opacity: 0.05 }}
          transition={{ duration: 2.2, ease: "easeOut", delay: 0.2 }}
          className="absolute w-48 h-48 rounded-full bg-primary-foreground"
        />

        {/* Logo mark */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="relative mb-6"
        >
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/15 backdrop-blur-sm border border-primary-foreground/20 flex items-center justify-center shadow-2xl">
            <span className="text-4xl font-display font-bold text-primary-foreground tracking-tight">C</span>
          </div>
        </motion.div>

        {/* Brand name */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
          className="text-3xl font-display font-bold text-primary-foreground tracking-wide mb-2"
        >
          Connect Plus
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.6 }}
          className="text-sm text-primary-foreground/70 font-medium tracking-widest uppercase"
        >
          Workforce Performance Platform
        </motion.p>

        {/* Loading bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-10 w-40 h-1 rounded-full bg-primary-foreground/15 overflow-hidden"
        >
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "0%" }}
            transition={{ duration: 1.6, ease: "easeInOut", delay: 0.9 }}
            className="h-full rounded-full bg-primary-foreground/50"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen;
