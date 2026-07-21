// import { Toaster } from "@/components/ui/toaster";
// import { Toaster as Sonner } from "@/components/ui/sonner";
// import { TooltipProvider } from "@/components/ui/tooltip";
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import { AppLayout } from "@/components/AppLayout";
// import { AuthProvider, useAuth } from "@/contexts/AuthContext";
// import Login from "./pages/Login";
// import Dashboard from "./pages/Dashboard";
// import SupervisorDashboard from "./pages/SupervisorDashboard";
// import TechnicianDashboard from "./pages/TechnicianDashboard";
// import CustomerDashboard from "./pages/CustomerDashboard";
// import ComplaintsList from "./pages/ComplaintsList";
// import ComplaintDetail from "./pages/ComplaintDetail";
// import ComplaintEdit from "./pages/ComplaintEdit";
// import Assignments from "./pages/Assignments";
// import KPIAnalytics from "./pages/KPIAnalytics";
// import Profile from "./pages/Profile";
// import NotFound from "./pages/NotFound";

// const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: {
//       retry: 1, // Retry failed requests once
//       retryDelay: 1000, // Wait 1 second between retries
//     },
//   },
// });

// function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
//   const { user, loading } = useAuth();

//   // Show loading spinner while checking auth
//   if (loading) {
//     return (
//       <div className="flex h-screen items-center justify-center bg-background">
//         <div className="flex flex-col items-center gap-4">
//           <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
//           <p className="text-sm text-muted-foreground">Loading...</p>
//         </div>
//       </div>
//     );
//   }

//   // Redirect to login if not authenticated
//   if (!user) {
//     return <Navigate to="/" replace />;
//   }

//   // Redirect to default dashboard if role not allowed
//   if (roles && !roles.includes(user.role)) {
//     return <Navigate to="/dashboard" replace />;
//   }

//   return <>{children}</>;
// }

// function DashboardRouter() {
//   const { user, loading } = useAuth();

//   if (loading || !user) {
//     return (
//       <div className="flex h-screen items-center justify-center">
//         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
//       </div>
//     );
//   }

//   switch (user.role) {
//     case "supervisor": return <SupervisorDashboard />;
//     case "technician": return <TechnicianDashboard />;
//     case "customer": return <CustomerDashboard />;
//     default: return <Dashboard />;
//   }
// }

// const AppRoutes = () => (
//   <Routes>
//     <Route path="/" element={<Login />} />
//     <Route path="/dashboard" element={
//       <ProtectedRoute>
//         <AppLayout>
//           <DashboardRouter />
//         </AppLayout>
//       </ProtectedRoute>
//     } />
//     <Route path="/complaints" element={
//       <ProtectedRoute roles={["admin", "supervisor"]}>
//         <AppLayout>
//           <ComplaintsList />
//         </AppLayout>
//       </ProtectedRoute>
//     } />
//     <Route path="/complaints/new" element={
//       <ProtectedRoute roles={["admin", "supervisor"]}>
//         <AppLayout>
//           <ComplaintEdit />
//         </AppLayout>
//       </ProtectedRoute>
//     } />
//     <Route path="/complaints/:id" element={
//       <ProtectedRoute>
//         <AppLayout>
//           <ComplaintDetail />
//         </AppLayout>
//       </ProtectedRoute>
//     } />
//     <Route path="/complaints/:id/edit" element={
//       <ProtectedRoute roles={["admin", "supervisor"]}>
//         <AppLayout>
//           <ComplaintEdit />
//         </AppLayout>
//       </ProtectedRoute>
//     } />
//     <Route path="/assignments" element={
//       <ProtectedRoute roles={["admin", "supervisor"]}>
//         <AppLayout>
//           <Assignments />
//         </AppLayout>
//       </ProtectedRoute>
//     } />
//     <Route path="/kpi" element={
//       <ProtectedRoute roles={["admin"]}>
//         <AppLayout>
//           <KPIAnalytics />
//         </AppLayout>
//       </ProtectedRoute>
//     } />
//     <Route path="/profile" element={
//       <ProtectedRoute>
//         <AppLayout>
//           <Profile />
//         </AppLayout>
//       </ProtectedRoute>
//     } />
//     <Route path="*" element={<NotFound />} />
//   </Routes>
// );

// const App = () => (
//   <QueryClientProvider client={queryClient}>
//     <TooltipProvider>
//       <Toaster />
//       <Sonner />
//       <AuthProvider>
//         <BrowserRouter>
//           <AppRoutes />
//         </BrowserRouter>
//       </AuthProvider>
//     </TooltipProvider>
//   </QueryClientProvider>
// );

// export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import TechnicianDashboard from "./pages/TechnicianDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import ComplaintsList from "./pages/ComplaintsList";
import ComplaintDetail from "./pages/ComplaintDetail";
import ComplaintEdit from "./pages/ComplaintEdit";
import Assignments from "./pages/Assignments";
import KPIAnalytics from "./pages/KPIAnalytics";
import UsersPage from "./pages/admin/Users";
import Profile from "./pages/Profile";
import UpdatePassword from "./pages/UpdatePassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// 🔐 Role-based route protection
function ProtectedRoute({
  children,
  roles
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

  // 🔥 FIX: Only check roles if they are provided
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

  // 🔐 Route to appropriate dashboard based on role
  switch (user.role) {
    case "admin": return <Dashboard />;
    case "supervisor": return <SupervisorDashboard />;
    case "technician": return <TechnicianDashboard />;
    case "customer": return <CustomerDashboard />;
    default: return <Dashboard />;
  }
}

const AppRoutes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // 🔗 Global redirect: If landing on any route with recovery tokens, redirect to /update-password
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log("🔑 Password recovery event detected! Redirecting to /update-password...");
        toast.info("Password recovery session started. Please set a new password.");
        navigate("/update-password");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Login />} />
      <Route path="/update-password" element={<UpdatePassword />} />

      {/* Dashboard - All authenticated users */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <AppLayout>
            <DashboardRouter />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* 🔐 Complaints List - All Logins */}
      <Route path="/complaints" element={
        <ProtectedRoute roles={["admin", "supervisor", "technician", "customer"]}>
          <AppLayout>
            <ComplaintsList />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* 🔥 FIX: NEW COMPLAINT - Admin and Customer ONLY */}
      <Route path="/complaints/new" element={
        <ProtectedRoute roles={["admin", "customer"]}>
          <AppLayout>
            <ComplaintEdit />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* Complaint Detail - All authenticated users */}
      <Route path="/complaints/:id" element={
        <ProtectedRoute>
          <AppLayout>
            <ComplaintDetail />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* Edit Complaint - Admin & Supervisor ONLY */}
      <Route path="/complaints/:id/edit" element={
        <ProtectedRoute roles={["admin", "supervisor"]}>
          <AppLayout>
            <ComplaintEdit />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* Assignments - Admin & Supervisor ONLY */}
      <Route path="/assignments" element={
        <ProtectedRoute roles={["admin", "supervisor"]}>
          <AppLayout>
            <Assignments />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* KPI Analytics - Admin ONLY */}
      <Route path="/kpi" element={
        <ProtectedRoute roles={["admin"]}>
          <AppLayout>
            <KPIAnalytics />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* User Management - Admin ONLY */}
      <Route path="/admin/users" element={
        <ProtectedRoute roles={["admin"]}>
          <AppLayout>
            <UsersPage />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* Profile - All authenticated users */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <AppLayout>
            <Profile />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;