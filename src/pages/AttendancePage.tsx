import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAttendance } from "@/hooks/useAttendance";
import { AttendanceDisclaimer } from "@/components/attendance/AttendanceDisclaimer";
import { FaceVerification } from "@/components/attendance/FaceVerification";
import { LocationVerification } from "@/components/attendance/LocationVerification";
import { AttendanceConfirmation } from "@/components/attendance/AttendanceConfirmation";
import { CheckOutConfirmation } from "@/components/attendance/CheckOutConfirmation";
import { AttendanceHistory } from "@/components/attendance/AttendanceHistory";
import { TodayStatus } from "@/components/attendance/TodayStatus";

const AttendancePage = () => {
  const [activeTab, setActiveTab] = useState("today");
  const {
    currentStep, activeFlowType, faceStatus, locationStatus, locationData,
    todayMarked, todayCheckedOut, attendanceHistory, errorMessage, officeRadius,
    formattedWorkingDuration, startAttendanceFlow, startCheckOutFlow,
    verifyFaceWithBackend, retryFaceVerification, verifyLocation,
    confirmAttendance, confirmCheckOut, resetFlow, getTodayAttendance,
    latestCheckInTime,
    fetchHistory,
  } = useAttendance();

  const todayRecord = getTodayAttendance();
  const showVerificationFlow = currentStep !== "disclaimer" && !todayMarked && activeFlowType === "checkin";
  const showCheckOutFlow = currentStep !== "disclaimer" && activeFlowType === "checkout" && !todayCheckedOut;

  const handleConfirmAttendance = async () => { await confirmAttendance(); resetFlow(); };
  const handleConfirmCheckOut = async () => { await confirmCheckOut(); resetFlow(); };

  const isInVerificationFlow = showVerificationFlow || showCheckOutFlow;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {!isInVerificationFlow ? (
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            if (value === "today") fetchHistory();
          }}
          className="space-y-6"
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="space-y-6">
            <TodayStatus
              record={todayRecord}
              onMarkAttendance={startAttendanceFlow}
              onMarkCheckOut={startCheckOutFlow}
              workingDuration={formattedWorkingDuration()}
              isCheckedOut={todayCheckedOut}
              todayMarked={todayMarked}
              fallbackCheckInTime={latestCheckInTime}
            />
            {currentStep === "disclaimer" && !todayMarked && !todayRecord && (
              <AttendanceDisclaimer onProceed={startAttendanceFlow} disabled={!!todayRecord} />
            )}
          </TabsContent>
          <TabsContent value="history">
            <AttendanceHistory records={attendanceHistory} />
          </TabsContent>
        </Tabs>
      ) : (
        <AnimatePresence mode="wait">
          {currentStep === "face" && (
            <FaceVerification key="face" status={faceStatus} errorMessage={errorMessage} onVerify={verifyFaceWithBackend} onRetry={retryFaceVerification} />
          )}
          {currentStep === "location" && (
            <LocationVerification key="location" status={locationStatus} locationData={locationData} officeRadius={officeRadius} errorMessage={errorMessage} onVerify={verifyLocation} />
          )}
          {currentStep === "confirmation" && activeFlowType === "checkin" && (
            <AttendanceConfirmation key="confirmation" locationData={locationData} onConfirm={handleConfirmAttendance} />
          )}
          {currentStep === "confirmation" && activeFlowType === "checkout" && (
            <CheckOutConfirmation key="checkout-confirmation" locationData={locationData} todayRecord={todayRecord} fallbackCheckInTime={latestCheckInTime} onConfirm={handleConfirmCheckOut} />
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
};

export default AttendancePage;
