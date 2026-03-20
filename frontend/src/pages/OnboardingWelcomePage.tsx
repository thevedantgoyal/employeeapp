import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const ORGANIZATION_NAME = import.meta.env.VITE_ORGANIZATION_NAME || "MIRROR";

const OnboardingWelcomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="max-w-lg mx-auto w-full flex-1 flex flex-col justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <h1 className="text-3xl md:text-4xl font-display font-bold">
            Welcome, {name}! 👋
          </h1>
          <p className="text-lg text-muted-foreground font-medium">
            Cache Digitech
          </p>
          <p className="text-muted-foreground">
            Let's get you set up. We'll show you your details and complete your profile.
          </p>
          <Button
            size="lg"
            className="w-full sm:w-auto mt-4"
            onClick={() => navigate("/onboarding/details")}
          >
            Continue
          </Button>
        </motion.div>
      </main>
    </div>
  );
};

export default OnboardingWelcomePage;
