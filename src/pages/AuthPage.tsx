import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || "";
const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || "common";
const AZURE_REDIRECT_URI =
  import.meta.env.VITE_AZURE_REDIRECT_URI ||
  `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/auth/callback/microsoft`;

type MsalInstance = import("@azure/msal-browser").PublicClientApplication;

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
});

const AuthPage = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, signInWithMicrosoft, resetPassword, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [msalReady, setMsalReady] = useState(false);
  const msalInstanceRef = useRef<MsalInstance | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const navigateAfterLogin = useCallback((loggedInUser: { first_login?: boolean; userType?: string } | null) => {
    if (loggedInUser?.first_login) {
      navigate("/onboarding", { replace: true });
    } else {
      const t = loggedInUser?.userType;
      if (t === "MANAGER" || t === "SENIOR_MANAGER") navigate("/manager", { replace: true });
      else navigate("/", { replace: true });
    }
  }, [navigate]);

  // Redirect if already logged in
  if (!loading && user) {
    const t = (user as { userType?: string }).userType;
    const dest = user.first_login ? "/onboarding" : (t === "MANAGER" || t === "SENIOR_MANAGER" ? "/manager" : "/");
    return <Navigate to={dest} replace />;
  }

  // Pre-initialize MSAL on mount so the click handler can call loginPopup() immediately (no async before it).
  // Calling loginPopup() after await import/initialize/handleRedirectPromise loses the user gesture and opens a blank popup.
  useEffect(() => {
    if (!AZURE_CLIENT_ID) return;
    let cancelled = false;
    (async () => {
      try {
        const { PublicClientApplication, LogLevel } = await import("@azure/msal-browser");
        const authority = `https://login.microsoftonline.com/${AZURE_TENANT_ID}`;
        // In Azure Portal: use "Single-page application" (not "Web"), add redirect URI exactly as AZURE_REDIRECT_URI.
        const msalConfig = {
          auth: {
            clientId: AZURE_CLIENT_ID,
            authority,
            redirectUri: AZURE_REDIRECT_URI,
          },
          cache: { cacheLocation: "sessionStorage" as const },
          system: {
            loggerOptions: {
              logLevel: LogLevel.Verbose,
              loggerCallback: (level: number, message: string, containsPii: boolean) => {
                if (containsPii) return;
                if (level === LogLevel.Error) console.error("[MSAL]", message);
                else if (level === LogLevel.Warning) console.warn("[MSAL]", message);
                else console.debug("[MSAL]", message);
              },
              piiLoggingEnabled: false,
            },
          },
        };
        console.debug("[MSAL] Config:", {
          clientId: msalConfig.auth.clientId,
          authority: msalConfig.auth.authority,
          redirectUri: msalConfig.auth.redirectUri,
          allDefined:
            !!msalConfig.auth.clientId && !!msalConfig.auth.authority && !!msalConfig.auth.redirectUri,
        });
        const msal = new PublicClientApplication(msalConfig);
        await msal.initialize();
        if (cancelled) return;
        msalInstanceRef.current = msal;
        setMsalReady(true);
      } catch (e) {
        if (!cancelled) {
          console.error("[MSAL] Init failed:", e);
          setMsalReady(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const validateForm = () => {
    try {
      if (isLogin) {
        loginSchema.parse(formData);
      } else {
        signupSchema.parse(formData);
      }
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            newErrors[error.path[0] as string] = error.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleMicrosoftSignIn = async () => {
    if (!AZURE_CLIENT_ID) {
      toast.error("Microsoft sign-in is not configured.");
      return;
    }
    const msal = msalInstanceRef.current;
    if (!msal) {
      toast.error("Sign-in is still loading. Please wait a moment and try again.");
      return;
    }
    setIsMicrosoftLoading(true);
    try {
      // Only clear any pending redirect; then loginPopup must run with no other async in between.
      try {
        await msal.handleRedirectPromise();
      } catch (_) {
        // Ignore no_token_request_cache_error / state_not_found when no redirect is pending.
      }
      const loginRequest = { scopes: ["User.Read", "openid", "profile"] };
      const popupWidth = 500;
      const popupHeight = 650;
      const left = Math.round((window.screen.width - popupWidth) / 2);
      const top = Math.round((window.screen.height - popupHeight) / 2);
      const popupWindowFeatures = `width=${popupWidth},height=${popupHeight},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`;
      let result: { idToken?: string };
      try {
        result = await msal.loginPopup(loginRequest, { popupWindowFeatures });
      } catch (popupErr) {
        console.error("[MSAL] loginPopup error (full):", popupErr);
        console.error("[MSAL] loginPopup error message:", popupErr instanceof Error ? popupErr.message : String(popupErr));
        console.error("[MSAL] loginPopup error stack:", popupErr instanceof Error ? popupErr.stack : "n/a");
        const errStr = String(popupErr);
        const isPopupBlocked =
          errStr.includes("popup_window_error") ||
          errStr.includes("popup_blocked") ||
          errStr.includes("blocked a popup") ||
          errStr.includes("user_cancelled");
        if (isPopupBlocked || errStr.includes("interaction_in_progress")) {
          toast.info("Opening sign-in in this window…");
          await msal.loginRedirect(loginRequest);
          return;
        }
        throw popupErr;
      }
      const idToken = result?.idToken;
      if (!idToken) {
        setIsMicrosoftLoading(false);
        toast.error("Microsoft sign-in did not return a token.");
        return;
      }
      const { error, user: loggedInUser } = await signInWithMicrosoft(idToken);
      if (error) {
        setIsMicrosoftLoading(false);
        toast.error(error.message);
        return;
      }
      toast.success("Welcome back!");
      navigateAfterLogin(loggedInUser ?? null);
    } catch (err) {
      setIsMicrosoftLoading(false);
      console.error("[MSAL] handleMicrosoftSignIn error:", err);
      const message = err instanceof Error ? err.message : "Microsoft sign-in failed";
      const errStr = String(err);
      if (errStr.includes("interaction_in_progress")) {
        toast.error("A sign-in window is already open. Please complete or close it and try again.");
      } else if (errStr.includes("no_token_request_cache_error") || errStr.includes("state_not_found")) {
        toast.error("Sign-in state expired. Please try again.");
      } else {
        toast.error(message);
      }
    }
  };

  const handleMicrosoftSignInInThisWindow = async () => {
    if (!AZURE_CLIENT_ID) return;
    setIsMicrosoftLoading(true);
    try {
      const { PublicClientApplication } = await import("@azure/msal-browser");
      const msalConfig = {
        auth: {
          clientId: AZURE_CLIENT_ID,
          authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
          redirectUri: AZURE_REDIRECT_URI,
        },
        cache: { cacheLocation: "sessionStorage" },
      };
      const msal = new PublicClientApplication(msalConfig);
      await msal.initialize();
      try {
        await msal.handleRedirectPromise();
      } catch (_) {}
      await msal.loginRedirect({ scopes: ["User.Read", "openid", "profile"] });
    } catch (err) {
      setIsMicrosoftLoading(false);
      toast.error(err instanceof Error ? err.message : "Microsoft sign-in failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        const { error, user: loggedInUser } = await signIn(formData.email, formData.password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Invalid email or password. Please try again.");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Welcome back!");
          navigateAfterLogin(loggedInUser ?? null);
        }
      } else {
        const { error, user: signedUpUser } = await signUp(formData.email, formData.password, formData.fullName);
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("This email is already registered. Please sign in instead.");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Account created successfully!");
          navigateAfterLogin(signedUpUser ?? null);
        }
      }
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-lg font-semibold">
            {isLogin ? "Login" : "Create Account"}
          </h1>
        </motion.div>

        {/* Hero Image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full h-48 rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-primary via-primary/80 to-accent"
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-primary-foreground">
              <div className="text-4xl font-display font-bold mb-2">MIRROR</div>
              <p className="text-sm opacity-90">Performance Tracking System</p>
            </div>
          </div>
        </motion.div>

        {/* Welcome Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-display font-bold mb-2">
            {isLogin ? "Welcome Back" : "Join Us"}
          </h2>
          <p className="text-muted-foreground">
            {isLogin
              ? "Log in to continue your journey of growth and reflection."
              : "Create an account to start tracking your performance."}
          </p>
        </motion.div>

        {/* Microsoft Sign In */}
        {isLogin && AZURE_CLIENT_ID && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-4"
          >
            <Button
              type="button"
              variant="outline"
              onClick={handleMicrosoftSignIn}
              disabled={isMicrosoftLoading || !msalReady}
              className="w-full py-6 text-base font-medium rounded-xl border-2 border-[#5E5E5E] bg-white text-[#5E5E5E] hover:bg-[#F3F3F3] hover:text-[#323130]"
            >
              {isMicrosoftLoading ? (
                <ConnectPlusLoader variant="button" message="Signing in..." />
              ) : !msalReady ? (
                <ConnectPlusLoader variant="button" message="Loading..." />
              ) : (
                <span className="flex items-center justify-center gap-3">
                  <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                    <rect width="10" height="10" fill="#F25022" />
                    <rect x="11" width="10" height="10" fill="#7FBA00" />
                    <rect y="11" width="10" height="10" fill="#00A4EF" />
                    <rect x="11" y="11" width="10" height="10" fill="#FFB900" />
                  </svg>
                  Sign in with Microsoft
                </span>
              )}
            </Button>
            <p className="mt-2 text-center">
              <button
                type="button"
                onClick={handleMicrosoftSignInInThisWindow}
                disabled={isMicrosoftLoading || !msalReady}
                className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50"
              >
                Popup not showing? Open in this window
              </button>
            </p>
          </motion.div>
        )}

        {isLogin && AZURE_CLIENT_ID && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onSubmit={handleSubmit}
          className="space-y-4 flex-1"
        >
          {!isLogin && (
            <div>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {errors.fullName && (
                <p className="text-destructive text-sm mt-1">{errors.fullName}</p>
              )}
            </div>
          )}

          <div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {errors.email && (
              <p className="text-destructive text-sm mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-12 pr-12 py-4 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <Eye className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-destructive text-sm mt-1">{errors.password}</p>
            )}
            {isLogin && (
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="text-sm text-primary hover:underline mt-1"
              >
                Forgot Password?
              </button>
            )}
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-6 text-base font-semibold rounded-xl"
            >
              {isSubmitting ? <ConnectPlusLoader variant="button" message={isLogin ? "Signing in..." : "Creating account..."} /> : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </div>
        </motion.form>

        {/* Forgot Password Modal */}
        {isForgotPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
            onClick={() => setIsForgotPassword(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-background rounded-2xl p-6 max-w-md w-full space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">Reset Password</h3>
              <p className="text-sm text-muted-foreground">Enter your email and we'll send you a link to reset your password.</p>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsForgotPassword(false)}>Cancel</Button>
                <Button
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={async () => {
                    if (!resetEmail) {
                      toast.error("Please enter your email");
                      return;
                    }
                    setIsSubmitting(true);
                    const { error } = await resetPassword(resetEmail);
                    setIsSubmitting(false);
                    if (error) {
                      toast.error(error.message);
                    } else {
                      toast.success("Password reset link sent! Check your email.");
                      setIsForgotPassword(false);
                      setResetEmail("");
                    }
                  }}
                >
                  {isSubmitting ? "Sending…" : "Send Link"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-6"
        >
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setErrors({});
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm text-muted-foreground mt-6"
        >
          Your work history is securely recorded
        </motion.p>
      </div>
    </div>
  );
};

export default AuthPage;
