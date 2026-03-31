import { useState, useCallback, lazy, Suspense } from "react";
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
import { ManagerRoute } from "@/components/auth/ManagerRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import SplashScreen from "@/components/SplashScreen";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ProjectsRouteGuard } from "./components/auth/ProjectsRouteGuard";
import { usePushNotificationsBootstrap } from "./hooks/usePushNotifications";
import { useCelebrations } from "./hooks/useCelebrations";
import CelebrationModal from "./components/CelebrationModal";
import { useAuth } from "@/contexts/AuthContext";

const Index = lazy(() => import("./pages/Index"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const PerformancePage = lazy(() => import("./pages/PerformancePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
const SkillsPage = lazy(() => import("./pages/SkillsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const InstallPage = lazy(() => import("./pages/InstallPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const LeavePage = lazy(() => import("./pages/LeavePage"));
const TimesheetPage = lazy(() => import("./pages/TimesheetPage"));
const RoomBookingPage = lazy(() => import("./pages/RoomBookingPage"));
const RequestsPage = lazy(() => import("./pages/RequestsPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const CompleteProfilePage = lazy(() => import("./pages/CompleteProfilePage"));
const OnboardingWelcomePage = lazy(() => import("./pages/OnboardingWelcomePage"));
const OnboardingDetailsPage = lazy(() => import("./pages/OnboardingDetailsPage"));
const TaskDetailPage = lazy(() => import("./pages/TaskDetailPage"));
const AdminEmployeeDetailPage = lazy(() => import("./pages/AdminEmployeeDetailPage"));
const MicrosoftAuthCallbackPage = lazy(() => import("./pages/MicrosoftAuthCallbackPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground text-sm">Loading…</div>
);

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
              <Suspense fallback={<PageFallback />}>
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
                  <Route path="/manager" element={<ManagerRoute><AppLayout><ManagerDashboard /></AppLayout></ManagerRoute>} />
                  <Route path="/reports" element={<OrganizationRoute><AppLayout><ReportsPage /></AppLayout></OrganizationRoute>} />
                  <Route path="/admin" element={<AdminRoute><AppLayout><AdminDashboard /></AppLayout></AdminRoute>} />
                  <Route path="/admin/employees/:id" element={<AdminRoute><AppLayout><AdminEmployeeDetailPage /></AppLayout></AdminRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
