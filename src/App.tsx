import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import ErrorBoundary from "@/components/ErrorBoundary";

// Eagerly loaded critical entry route
import Login from "./pages/Login";

// Lazy-loaded routes for code-splitting and ultra-fast initial bundle loading
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SupervisorDashboard = lazy(() => import("./pages/SupervisorDashboard"));
const TechnicianDashboard = lazy(() => import("./pages/TechnicianDashboard"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const ComplaintsList = lazy(() => import("./pages/ComplaintsList"));
const ComplaintDetail = lazy(() => import("./pages/ComplaintDetail"));
const ComplaintEdit = lazy(() => import("./pages/ComplaintEdit"));
const Assignments = lazy(() => import("./pages/Assignments"));
const KPIAnalytics = lazy(() => import("./pages/KPIAnalytics"));
const UsersPage = lazy(() => import("./pages/admin/Users"));
const DailySchedule = lazy(() => import("./pages/DailySchedule"));
const Installations = lazy(() => import("./pages/Installations"));
const InstallationDetail = lazy(() => import("./pages/InstallationDetail"));
const Customers = lazy(() => import("./pages/Customers"));
const Assets = lazy(() => import("./pages/Assets"));
const ServiceReports = lazy(() => import("./pages/ServiceReports"));
const Profile = lazy(() => import("./pages/Profile"));
const PriorityMatrix = lazy(() => import("./pages/PriorityMatrix"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 1000,
      refetchOnWindowFocus: false,
    },
  },
});

// Subtle loading fallback for chunk transitions
function PageLoadingFallback() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute w-2 h-2 rounded-full bg-primary animate-ping" />
        </div>
        <p className="text-xs font-medium text-muted-foreground animate-pulse tracking-wide">
          Loading module...
        </p>
      </div>
    </div>
  );
}

// 🔐 Role-based route protection
function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (roles && roles.length > 0 && user.role && !roles.includes(user.role)) {
    console.warn(`⚠️ Access denied: ${user.role} tried to access ${window.location.pathname}`);
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Role-based dashboard router
function DashboardRouter() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  switch (user.role) {
    case "admin":
      return <Dashboard />;
    case "supervisor":
      return <SupervisorDashboard />;
    case "technician":
      return <TechnicianDashboard />;
    case "customer":
      return <CustomerDashboard />;
    default:
      return <Dashboard />;
  }
}

const AppRoutes = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const hasRecoveryParams =
      window.location.search.includes("code=") ||
      window.location.hash.includes("type=recovery") ||
      window.location.hash.includes("access_token=") ||
      window.location.search.includes("type=recovery") ||
      window.location.href.includes("recovery");

    if (hasRecoveryParams && window.location.pathname !== "/update-password") {
      console.log("🔄 Found recovery parameters in URL. Redirecting to /update-password...");
      navigate(`/update-password${window.location.search}${window.location.hash}`, { replace: true });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log("🔑 Password recovery event detected! Redirecting to /update-password...");
        toast.info("Password recovery session started. Please set a new password.");
        if (window.location.pathname !== "/update-password") {
          navigate(`/update-password${window.location.search}${window.location.hash}`);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <ErrorBoundary fallbackTitle="Navigation Error" fallbackMessage="Unable to load this section. Please try again.">
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/update-password" element={<UpdatePassword />} />

          {/* Dashboard - All authenticated users */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardRouter />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* 🔐 Complaints List - All Logins */}
          <Route
            path="/complaints"
            element={
              <ProtectedRoute roles={["admin", "supervisor", "technician", "customer"]}>
                <AppLayout>
                  <ComplaintsList />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* 🔥 FIX: NEW COMPLAINT - Admin and Customer ONLY */}
          <Route
            path="/complaints/new"
            element={
              <ProtectedRoute roles={["admin", "customer"]}>
                <AppLayout>
                  <ComplaintEdit />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Complaint Detail - All authenticated users */}
          <Route
            path="/complaints/:id"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ComplaintDetail />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Edit Complaint - Admin & Supervisor ONLY */}
          <Route
            path="/complaints/:id/edit"
            element={
              <ProtectedRoute roles={["admin", "supervisor"]}>
                <AppLayout>
                  <ComplaintEdit />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Assignments - Admin & Supervisor ONLY */}
          <Route
            path="/assignments"
            element={
              <ProtectedRoute roles={["admin", "supervisor"]}>
                <AppLayout>
                  <Assignments />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Installations - Admin ONLY */}
          <Route
            path="/installations"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AppLayout>
                  <Installations />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Installation Detail - Admin, Supervisor, and Technician */}
          <Route
            path="/installations/:id"
            element={
              <ProtectedRoute roles={["admin", "supervisor", "technician"]}>
                <AppLayout>
                  <InstallationDetail />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Daily Schedule - Admin, Supervisor, and Technician */}
          <Route
            path="/daily-schedule"
            element={
              <ProtectedRoute roles={["admin", "supervisor", "technician"]}>
                <AppLayout>
                  <DailySchedule />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Service Reports - Admin and Manager Only */}
          <Route
            path="/service-reports"
            element={
              <ProtectedRoute roles={["admin", "manager"]}>
                <AppLayout>
                  <ServiceReports />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* KPI Analytics - Admin ONLY */}
          <Route
            path="/kpi"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AppLayout>
                  <KPIAnalytics />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Priority Matrix - Admin and Supervisor ONLY */}
          <Route
            path="/priority-matrix"
            element={
              <ProtectedRoute roles={["admin", "supervisor"]}>
                <AppLayout>
                  <PriorityMatrix />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* User Management - Admin ONLY */}
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AppLayout>
                  <UsersPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Customers Page - Admin & Supervisor ONLY */}
          <Route
            path="/customers"
            element={
              <ProtectedRoute roles={["admin", "supervisor"]}>
                <AppLayout>
                  <Customers />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Assets Page - All authenticated users */}
          <Route
            path="/assets"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Assets />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Profile - All authenticated users */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Profile />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

// ✅ Invisible Native Permission Handler
function NativePermissionHandler() {
  useEffect(() => {
    const handleFirstClick = () => {
      const alreadyRequested = localStorage.getItem("notification_permission_requested");

      if (Notification.permission === "default" && !alreadyRequested) {
        Notification.requestPermission().then((permission) => {
          localStorage.setItem("notification_permission_requested", "true");
          console.log("🔔 Native browser permission result:", permission);
        });
      }
      document.removeEventListener("click", handleFirstClick);
    };

    document.addEventListener("click", handleFirstClick);

    return () => {
      document.removeEventListener("click", handleFirstClick);
    };
  }, []);

  return null;
}

// Suppress non-critical Supabase realtime WebSocket errors in environments where realtime is unavailable
function RealtimeErrorSuppressor() {
  useEffect(() => {
    const realtimeMessages = [
      "realtime",
      "websocket",
      "transportconnect",
      "wss://supportapi.brihaspathi.in/realtime",
      "realtime/v1/websocket",
    ];

    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const filteredConsoleError = (...args: any[]) => {
      const message = args
        .map((arg) => (typeof arg === "string" ? arg : arg?.message || arg?.toString?.() || ""))
        .join(" ")
        .toLowerCase();

      const shouldSuppress = realtimeMessages.some((keyword) => message.includes(keyword));
      if (shouldSuppress) {
        return;
      }

      originalConsoleError.apply(console, args);
    };

    const filteredConsoleWarn = (...args: any[]) => {
      const message = args
        .map((arg) => (typeof arg === "string" ? arg : arg?.message || arg?.toString?.() || ""))
        .join(" ")
        .toLowerCase();

      const shouldSuppress = realtimeMessages.some((keyword) => message.includes(keyword));
      if (shouldSuppress) {
        return;
      }

      originalConsoleWarn.apply(console, args);
    };

    console.error = filteredConsoleError;
    console.warn = filteredConsoleWarn;

    const suppressRealtimeError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const message =
        ("message" in event ? event.message : "") ||
        (event as any)?.reason?.message ||
        (typeof (event as any)?.reason === "string" ? (event as any).reason : "") ||
        "";
      const lower = message.toLowerCase();
      if (
        lower.includes("realtime") ||
        lower.includes("websocket") ||
        lower.includes("transportconnect") ||
        lower.includes("wss://supportapi.brihaspathi.in/realtime")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      suppressRealtimeError(event);
    };

    const handleError = (event: ErrorEvent) => {
      suppressRealtimeError(event);
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <RealtimeErrorSuppressor />
          <NativePermissionHandler />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;