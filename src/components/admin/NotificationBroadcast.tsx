import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Send, 
  Clock, 
  Users, 
  User, 
  Shield, 
  Bell,
  Mail,
  Loader2,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/integrations/api/db";
import { toast } from "sonner";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface NotificationBroadcastProps {
  employees: Employee[];
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export const NotificationBroadcast = ({ employees }: NotificationBroadcastProps) => {
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"all" | "role" | "user">("all");
  const [targetValue, setTargetValue] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "scheduled">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [sendPush, setSendPush] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);

  const roles = ["employee", "team_lead", "manager", "hr", "admin", "organization"];

  const handleSendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Please enter both title and message");
      return;
    }

    if (targetType !== "all" && !targetValue) {
      toast.error(`Please select a ${targetType === "role" ? "role" : "user"}`);
      return;
    }

    if (scheduleType === "scheduled" && (!scheduledDate || !scheduledTime)) {
      toast.error("Please select a date and time for scheduled notification");
      return;
    }

    setLoading(true);

    try {
      const scheduledAt = scheduleType === "now" 
        ? new Date().toISOString()
        : new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

      const { error } = await db.functions.invoke("send-broadcast", {
        body: {
          title,
          message,
          target_type: targetType,
          target_value: targetType === "all" ? null : targetValue,
          scheduled_at: scheduledAt,
          send_push: sendPush,
          send_email: sendEmail,
          send_now: scheduleType === "now",
        },
      });

      if (error) throw error;

      toast.success(
        scheduleType === "now" 
          ? "Notification sent successfully!" 
          : "Notification scheduled successfully!"
      );

      // Reset form
      setTitle("");
      setMessage("");
      setTargetType("all");
      setTargetValue("");
      setScheduleType("now");
      setScheduledDate("");
      setScheduledTime("");
    } catch (err) {
      console.error("Error sending notification:", err);
      toast.error("Failed to send notification");
    } finally {
      setLoading(false);
    }
  };

  // Get minimum date/time (now)
  const now = new Date();
  const minDate = now.toISOString().split("T")[0];
  const minTime = scheduledDate === minDate 
    ? now.toTimeString().slice(0, 5) 
    : "00:00";

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Notification Content */}
      <div className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Compose Notification
        </h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="notification-title">Title</Label>
            <Input
              id="notification-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title..."
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="notification-message">Message</Label>
            <Textarea
              id="notification-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your notification message..."
              rows={4}
              className="mt-1.5"
            />
          </div>
        </div>
      </div>

      {/* Target Selection */}
      <div className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Recipients
        </h3>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={targetType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTargetType("all");
                setTargetValue("");
              }}
              className="flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              All Users
            </Button>
            <Button
              variant={targetType === "role" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTargetType("role");
                setTargetValue("");
              }}
              className="flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              By Role
            </Button>
            <Button
              variant={targetType === "user" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTargetType("user");
                setTargetValue("");
              }}
              className="flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              Specific User
            </Button>
          </div>

          {targetType === "role" && (
            <Select value={targetValue} onValueChange={setTargetValue}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1).replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {targetType === "user" && (
            <Select value={targetValue} onValueChange={setTargetValue}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.user_id} value={emp.user_id}>
                    {emp.full_name} ({emp.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Scheduling */}
      <div className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Timing
        </h3>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={scheduleType === "now" ? "default" : "outline"}
              size="sm"
              onClick={() => setScheduleType("now")}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Now
            </Button>
            <Button
              variant={scheduleType === "scheduled" ? "default" : "outline"}
              size="sm"
              onClick={() => setScheduleType("scheduled")}
              className="flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Schedule
            </Button>
          </div>

          {scheduleType === "scheduled" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="schedule-date">Date</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={minDate}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="schedule-time">Time</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  min={scheduledDate === minDate ? minTime : undefined}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Options */}
      <div className="bg-card rounded-2xl p-6 shadow-soft border border-border/50">
        <h3 className="text-lg font-semibold mb-4">Delivery Methods</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">Push Notification</p>
                <p className="text-xs text-muted-foreground">Send to mobile/desktop apps</p>
              </div>
            </div>
            <Switch checked={sendPush} onCheckedChange={setSendPush} />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">Email Notification</p>
                <p className="text-xs text-muted-foreground">Send to user's email</p>
              </div>
            </div>
            <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
          </div>
        </div>
      </div>

      {/* Send Button */}
      <Button
        onClick={handleSendNotification}
        disabled={loading || !title.trim() || !message.trim()}
        className="w-full py-6 text-lg font-semibold"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            {scheduleType === "now" ? "Sending..." : "Scheduling..."}
          </>
        ) : (
          <>
            {scheduleType === "now" ? (
              <>
                <Send className="w-5 h-5 mr-2" />
                Send Notification
              </>
            ) : (
              <>
                <Calendar className="w-5 h-5 mr-2" />
                Schedule Notification
              </>
            )}
          </>
        )}
      </Button>
    </motion.div>
  );
};
