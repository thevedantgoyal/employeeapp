import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConnectPlusLoader } from "@/components/ui/ConnectPlusLoader";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || "";
const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || "common";
const CALLBACK_PATH = "/auth/callback/microsoft";

/**
 * Page at the redirect URI after Microsoft sign-in.
 * - Popup flow: this runs in the popup; we just handleRedirectPromise() and close so the opener gets the result.
 * - Redirect flow: we handleRedirectPromise(), exchange token with backend, then navigate to / or /onboarding.
 */
const MicrosoftAuthCallbackPage = () => {
  const navigate = useNavigate();
  const { signInWithMicrosoft } = useAuth();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const isPopup = typeof window !== "undefined" && !!window.opener;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!AZURE_CLIENT_ID) {
        if (!cancelled) setStatus("error");
        return;
      }
      try {
        const { PublicClientApplication } = await import("@azure/msal-browser");
        const redirectUri =
          import.meta.env.VITE_AZURE_REDIRECT_URI ||
          `${window.location.origin}${CALLBACK_PATH}`;
        const msalConfig = {
          auth: {
            clientId: AZURE_CLIENT_ID,
            authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
            redirectUri,
          },
          cache: { cacheLocation: "sessionStorage" },
        };
        const msal = new PublicClientApplication(msalConfig);
        await msal.initialize();
        const result = await msal.handleRedirectPromise();
        if (cancelled) return;
        if (isPopup) {
          if (!cancelled) setStatus("done");
          window.close();
          return;
        }
        if (!result?.idToken) {
          setStatus("error");
          return;
        }
        const { error, user: loggedInUser } = await signInWithMicrosoft(result.idToken);
        if (cancelled) return;
        if (error) {
          toast.error(error.message);
          setStatus("error");
          return;
        }
        setStatus("done");
        toast.success("Welcome back!");
        if (loggedInUser?.first_login) {
          navigate("/onboarding", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isPopup, signInWithMicrosoft, navigate]);

  useEffect(() => {
    if (status !== "error") return;
    if (isPopup) {
      window.close();
    } else {
      navigate("/auth", { replace: true });
    }
  }, [status, isPopup, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <ConnectPlusLoader />
      <p className="text-muted-foreground text-sm">
        {status === "loading" ? "Completing sign-in…" : status === "done" ? "Redirecting…" : "Sign-in failed. Redirecting…"}
      </p>
    </div>
  );
};

export default MicrosoftAuthCallbackPage;
