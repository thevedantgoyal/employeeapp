import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeaveManagement } from "@/hooks/useLeaveManagement";
import { LeaveBalanceCards } from "@/components/leave/LeaveBalanceCards";
import { ApplyLeaveForm } from "@/components/leave/ApplyLeaveForm";
import { LeaveHistory } from "@/components/leave/LeaveHistory";
import { LeaveRequests } from "@/components/leave/LeaveRequests";
import { useLeaveRequestsAccess } from "@/hooks/useLeaveRequests";

const LeavePage = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const leave = useLeaveManagement();
  const { canView: canViewRequests, loading: accessLoading } = useLeaveRequestsAccess();

  const showRequestsTab = !accessLoading && canViewRequests;

  return (
    <AnimatePresence mode="wait">
      {leave.isApplying ? (
        <motion.div key="apply" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          <ApplyLeaveForm
            balances={leave.balances}
            calculateDays={leave.calculateDays}
            validate={leave.validateLeaveRequest}
            onSubmit={(code, from, to, half, reason, attachment) => {
              leave.submitLeaveRequest(code, from, to, half, reason, attachment);
              leave.setIsApplying(false);
            }}
            onCancel={() => leave.setIsApplying(false)}
          />
        </motion.div>
      ) : (
        <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className={`w-full grid ${showRequestsTab ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              {showRequestsTab && (
                <TabsTrigger value="requests">Leave Requests</TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="dashboard" className="space-y-6">
              <LeaveBalanceCards balances={leave.balances} onApplyLeave={() => leave.setIsApplying(true)} />
            </TabsContent>
            <TabsContent value="history">
              <LeaveHistory requests={leave.leaveRequests} />
            </TabsContent>
            {showRequestsTab && (
              <TabsContent value="requests">
                <LeaveRequests />
              </TabsContent>
            )}
          </Tabs>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LeavePage;
