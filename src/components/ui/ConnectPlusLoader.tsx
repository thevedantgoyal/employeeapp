import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ConnectPlusLoaderProps {
  variant?: "fullscreen" | "inline" | "button";
  message?: string;
}

export const ConnectPlusLoader = ({ variant = "inline", message }: ConnectPlusLoaderProps) => {
  const logoSize = variant === "button" ? "w-5 h-5" : variant === "inline" ? "w-12 h-12" : "w-16 h-16";
  const ringSize = variant === "button" ? "w-7 h-7" : variant === "inline" ? "w-16 h-16" : "w-20 h-20";
  const fontSize = variant === "button" ? "text-xs" : variant === "inline" ? "text-xl" : "text-2xl";

  const loader = (
    <div className={cn("flex flex-col items-center justify-center gap-3", variant === "button" && "flex-row gap-2")}>
      <div className="relative flex items-center justify-center">
        {/* Spinning ring */}
        <div
          className={cn(
            ringSize,
            "absolute rounded-full border-2 border-primary/20 border-t-primary animate-spin"
          )}
        />
        {/* Pulsing logo */}
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            logoSize,
            "rounded-lg bg-primary/10 flex items-center justify-center"
          )}
        >
          <span className={cn(fontSize, "font-display font-bold text-primary")}>C</span>
        </motion.div>
      </div>
      {message && variant !== "button" && (
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
      )}
      {message && variant === "button" && (
        <span className="text-sm">{message}</span>
      )}
    </div>
  );

  if (variant === "fullscreen") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center fixed inset-0 z-50">
        {loader}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center py-12">
        {loader}
      </div>
    );
  }

  // button variant
  return loader;
};
