import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Key, Send, CheckCircle2, XCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/integrations/api/db";
import { toast } from "sonner";

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

interface EmailSettingsProps {
  onApiKeyUpdate?: () => void;
}

export const EmailSettings = ({ onApiKeyUpdate }: EmailSettingsProps) => {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<"success" | "error" | "not-configured" | null>(null);

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error("Please enter a test email address");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await db.functions.invoke("send-email", {
        body: {
          to: testEmail,
          subject: "Test Email from Your App",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #6366f1;">Email Configuration Test</h1>
              <p>This is a test email to verify your email notification system is working correctly.</p>
              <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                If you received this email, your Resend integration is configured properly!
              </p>
            </div>
          `,
          type: "test",
        },
      });

      if (response.error) {
        throw response.error;
      }

      if (response.data?.success === false && response.data?.message?.includes("not configured")) {
        setTestResult("not-configured");
        toast.error("Email service not configured. Please add RESEND_API_KEY.");
      } else if (response.data?.success) {
        setTestResult("success");
        toast.success("Test email sent successfully!");
      } else {
        throw new Error(response.data?.error || "Failed to send test email");
      }
    } catch (error) {
      console.error("Test email error:", error);
      setTestResult("error");
      toast.error("Failed to send test email");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Service Status */}
      <motion.div variants={itemVariants} className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Email Notifications</h3>
            <p className="text-sm text-muted-foreground">Configure email delivery for notifications</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* API Key Info */}
          <div className="p-4 bg-muted/50 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Resend API Key</p>
                <p className="text-xs text-muted-foreground mt-1">
                  To enable email notifications, you need to add a RESEND_API_KEY secret.
                </p>
                <ol className="text-xs text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
                  <li>Sign up at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">resend.com</a></li>
                  <li>Verify your email domain at <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">resend.com/domains</a></li>
                  <li>Create an API key at <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">resend.com/api-keys</a></li>
                  <li>Add the secret as RESEND_API_KEY in your backend settings</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Test Email Section */}
          <div className="border-t border-border pt-4">
            <h4 className="font-medium text-sm mb-3">Test Email Configuration</h4>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter test email address"
                className="flex-1 p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              />
              <Button
                onClick={handleTestEmail}
                disabled={testing}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                {testing ? "Sending..." : "Send Test"}
              </Button>
            </div>

            {/* Test Result */}
            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-3 p-3 rounded-xl flex items-center gap-2 ${
                  testResult === "success"
                    ? "bg-green-500/10 text-green-600"
                    : testResult === "not-configured"
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {testResult === "success" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm">Email sent successfully! Check your inbox.</span>
                  </>
                ) : testResult === "not-configured" ? (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">Email service not configured. Add RESEND_API_KEY secret.</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm">Failed to send email. Check your API key and domain verification.</span>
                  </>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Email Templates Info */}
      <motion.div variants={itemVariants} className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
        <h3 className="font-semibold mb-4">Notification Types</h3>
        <div className="grid gap-3">
          <div className="p-4 bg-muted/50 rounded-xl flex items-start gap-3">
            <div className="p-1.5 bg-blue-500/10 rounded-lg">
              <Mail className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Task Assigned</p>
              <p className="text-xs text-muted-foreground">Sent when a task is assigned to an employee</p>
            </div>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl flex items-start gap-3">
            <div className="p-1.5 bg-green-500/10 rounded-lg">
              <Mail className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Contribution Approved</p>
              <p className="text-xs text-muted-foreground">Sent when a manager approves a work contribution</p>
            </div>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl flex items-start gap-3">
            <div className="p-1.5 bg-amber-500/10 rounded-lg">
              <Mail className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Contribution Rejected</p>
              <p className="text-xs text-muted-foreground">Sent when a manager requests changes to a contribution</p>
            </div>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl flex items-start gap-3">
            <div className="p-1.5 bg-purple-500/10 rounded-lg">
              <Mail className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Role Changed</p>
              <p className="text-xs text-muted-foreground">Sent when an employee's role is updated</p>
            </div>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl flex items-start gap-3">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg">
              <Mail className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Team Assignment</p>
              <p className="text-xs text-muted-foreground">Sent when an employee is added to a team</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
