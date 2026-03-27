import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProfileCompletionGuard } from "@/components/auth/ProfileCompletionGuard";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { OrganizationRoute } from "@/components/auth/OrganizationRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import SplashScreen from "@/components/SplashScreen";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import Index from "./pages/Index";
import TasksPage from "./pages/TasksPage";
import HistoryPage from "./pages/HistoryPage";
import PerformancePage from "./pages/PerformancePage";
import ProfilePage from "./pages/ProfilePage";
import AuthPage from "./pages/AuthPage";
import AdminDashboard from "./pages/AdminDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import SkillsPage from "./pages/SkillsPage";
import ReportsPage from "./pages/ReportsPage";
import InstallPage from "./pages/InstallPage";
import AttendancePage from "./pages/AttendancePage";
import LeavePage from "./pages/LeavePage";
import TimesheetPage from "./pages/TimesheetPage";
import RoomBookingPage from "./pages/RoomBookingPage";
import RequestsPage from "./pages/RequestsPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { ProjectsRouteGuard } from "./components/auth/ProjectsRouteGuard";
import CompleteProfilePage from "./pages/CompleteProfilePage";
import OnboardingWelcomePage from "./pages/OnboardingWelcomePage";
import OnboardingDetailsPage from "./pages/OnboardingDetailsPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import AdminEmployeeDetailPage from "./pages/AdminEmployeeDetailPage";
import MicrosoftAuthCallbackPage from "./pages/MicrosoftAuthCallbackPage";
import NotFound from "./pages/NotFound";
import { usePushNotificationsBootstrap } from "./hooks/usePushNotifications";
import { useCelebrations } from "./hooks/useCelebrations";
import CelebrationModal from "./components/CelebrationModal";
import { useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

const ProtectedWithLayout = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <ProfileCompletionGuard>
      <AppLayout>{children}</AppLayout>
    </ProfileCompletionGuard>
  </ProtectedRoute>
);

const CelebrationGate = () => {
  const { user } = useAuth();
  const { celebrations, showModal, closeModal, handleWishSent } = useCelebrations(!!user);
  if (!showModal || celebrations.length === 0) return null;
  return (
    <CelebrationModal
      celebrations={celebrations}
      onClose={closeModal}
      onWishSent={handleWishSent}
    />
  );
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashComplete = useCallback(() => setShowSplash(false), []);
  usePushNotificationsBootstrap(true);

  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
            <AuthProvider>
              <CelebrationGate />
              <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/callback/microsoft" element={<MicrosoftAuthCallbackPage />} />
              <Route path="/signup" element={<Navigate to="/auth" replace />} />
              <Route path="/register" element={<Navigate to="/auth" replace />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingWelcomePage /></ProtectedRoute>} />
              <Route path="/onboarding/details" element={<ProtectedRoute><OnboardingDetailsPage /></ProtectedRoute>} />
              <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfilePage /></ProtectedRoute>} />
              <Route path="/install" element={<InstallPage />} />
              <Route path="/" element={<ProtectedWithLayout><Index /></ProtectedWithLayout>} />
              <Route path="/tasks" element={<ProtectedWithLayout><TasksPage /></ProtectedWithLayout>} />
              <Route path="/tasks/:id" element={<ProtectedWithLayout><TaskDetailPage /></ProtectedWithLayout>} />
              <Route path="/history" element={<ProtectedWithLayout><HistoryPage /></ProtectedWithLayout>} />
              <Route path="/performance" element={<ProtectedWithLayout><PerformancePage /></ProtectedWithLayout>} />
              <Route path="/profile" element={<ProtectedWithLayout><ProfilePage /></ProtectedWithLayout>} />
              <Route path="/skills" element={<ProtectedWithLayout><SkillsPage /></ProtectedWithLayout>} />
              <Route path="/attendance" element={<ProtectedWithLayout><AttendancePage /></ProtectedWithLayout>} />
              <Route path="/leave" element={<ProtectedWithLayout><LeavePage /></ProtectedWithLayout>} />
              <Route path="/timesheet" element={<ProtectedWithLayout><TimesheetPage /></ProtectedWithLayout>} />
              <Route path="/rooms" element={<ProtectedWithLayout><RoomBookingPage /></ProtectedWithLayout>} />
              <Route path="/requests" element={<ProtectedWithLayout><RequestsPage /></ProtectedWithLayout>} />
              <Route path="/requests/:requestId" element={<ProtectedWithLayout><RequestsPage /></ProtectedWithLayout>} />
              <Route path="/projects" element={<ProtectedWithLayout><ProjectsRouteGuard /></ProtectedWithLayout>} />
              <Route path="/manager" element={<ProtectedWithLayout><ManagerDashboard /></ProtectedWithLayout>} />
              <Route path="/reports" element={<OrganizationRoute><AppLayout><ReportsPage /></AppLayout></OrganizationRoute>} />
              <Route path="/admin" element={<AdminRoute><AppLayout><AdminDashboard /></AppLayout></AdminRoute>} />
              <Route path="/admin/employees/:id" element={<AdminRoute><AppLayout><AdminEmployeeDetailPage /></AppLayout></AdminRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
