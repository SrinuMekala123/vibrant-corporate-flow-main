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
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
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
import Profile from "./pages/Profile";
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

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Login />} />

      {/* Dashboard - All authenticated users */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <AppLayout>
            <DashboardRouter />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* 🔐 Complaints List - Admin & Supervisor ONLY */}
      <Route path="/complaints" element={
        <ProtectedRoute roles={["admin", "supervisor"]}>
          <AppLayout>
            <ComplaintsList />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* 🔥 FIX: NEW COMPLAINT - ALL authenticated users (including customers) */}
      <Route path="/complaints/new" element={
        <ProtectedRoute>
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