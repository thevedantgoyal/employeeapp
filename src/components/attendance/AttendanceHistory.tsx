import { motion } from "framer-motion";
import { 
  CheckCircle, 
  XCircle, 
  Camera, 
  MapPin, 
  Clock, 
  Calendar,
  FileText,
  LogOut,
  Timer
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AttendanceRecord } from "@/hooks/useAttendance";
import { format, parseISO } from "date-fns";

interface AttendanceHistoryProps {
  records: AttendanceRecord[];
}

export const AttendanceHistory = ({ records }: AttendanceHistoryProps) => {
  const getStatusBadge = (record: AttendanceRecord) => {
    if (record.status === "absent") {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Absent
        </Badge>
      );
    }
    if (record.checkOutTime) {
      return (
        <Badge className="bg-primary hover:bg-primary/90">
          <CheckCircle className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    }
    if (record.checkInTime) {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600">
          <Clock className="w-3 h-3 mr-1" />
          Checked In
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Attendance History</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Your past attendance records
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No attendance records yet</p>
            </div>
          ) : (
            records.map((record, index) => (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-muted/30 rounded-xl p-4 border hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {format(parseISO(record.date), "dd")}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase">
                        {format(parseISO(record.date), "MMM")}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">
                        {format(parseISO(record.date), "EEEE")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(record.date), "yyyy")}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(record)}
                </div>

                {record.status === "present" && (
                  <>
                    {/* In/Out times and duration */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50">
                      <div className="flex flex-col items-center gap-1 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs">In</span>
                        </div>
                        <span className="font-medium text-emerald-600">{record.checkInTime || "—"}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <LogOut className="w-3.5 h-3.5" />
                          <span className="text-xs">Out</span>
                        </div>
                        <span className="font-medium text-primary">{record.checkOutTime || "—"}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Timer className="w-3.5 h-3.5" />
                          <span className="text-xs">Duration</span>
                        </div>
                        <span className="font-medium">{record.totalHoursWorked || "Active"}</span>
                      </div>
                    </div>

                    {/* Verification status */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Check-In</p>
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded ${record.faceVerified ? "bg-emerald-500/20" : "bg-muted"}`}>
                            <Camera className={`w-3 h-3 ${record.faceVerified ? "text-emerald-600" : "text-muted-foreground"}`} />
                          </div>
                          <div className={`p-1 rounded ${record.locationVerified ? "bg-emerald-500/20" : "bg-muted"}`}>
                            <MapPin className={`w-3 h-3 ${record.locationVerified ? "text-emerald-600" : "text-muted-foreground"}`} />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Check-Out</p>
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded ${record.checkOutFaceVerified ? "bg-primary/20" : "bg-muted"}`}>
                            <Camera className={`w-3 h-3 ${record.checkOutFaceVerified ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className={`p-1 rounded ${record.checkOutLocationVerified ? "bg-primary/20" : "bg-muted"}`}>
                            <MapPin className={`w-3 h-3 ${record.checkOutLocationVerified ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        {record.verificationMethod}
                      </div>
                    </div>
                  </>
                )}

                {record.status === "absent" && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-sm text-muted-foreground">
                      No attendance recorded for this day
                    </p>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
