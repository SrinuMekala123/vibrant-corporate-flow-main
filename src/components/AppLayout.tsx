// import { useState } from "react";
// import { NavLink, useLocation, useNavigate } from "react-router-dom";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   LayoutDashboard,
//   ClipboardList,
//   Users,
//   BarChart3,
//   User,
//   LogOut,
//   ChevronLeft,
//   ChevronRight,
//   Zap,
//   Menu,
//   X,
//   Wrench,
// } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { useAuth, UserRole } from "@/contexts/AuthContext";

// interface NavItem {
//   to: string;
//   label: string;
//   icon: React.ElementType;
//   roles: UserRole[];
// }

// const navItems: NavItem[] = [
//   { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "supervisor", "technician", "customer"] },
//   { to: "/complaints", label: "Complaints", icon: ClipboardList, roles: ["admin", "supervisor"] },
//   { to: "/assignments", label: "Assignments", icon: Users, roles: ["admin", "supervisor"] },
//   { to: "/kpi", label: "KPI Analytics", icon: BarChart3, roles: ["admin"] },
//   { to: "/profile", label: "Profile", icon: User, roles: ["admin", "supervisor", "technician", "customer"] },
// ];

// const roleLabels: Record<UserRole, string> = {
//   admin: "Administrator",
//   supervisor: "Supervisor",
//   technician: "Field Technician",
//   customer: "Customer",
// };

// export function AppLayout({ children }: { children: React.ReactNode }) {
//   const [collapsed, setCollapsed] = useState(false);
//   const [mobileOpen, setMobileOpen] = useState(false);
//   const location = useLocation();
//   const navigate = useNavigate();

//   // ✅ FIX: Changed 'logout' to 'signOut'
//   const { user, signOut, loading } = useAuth();

//   const visibleNavItems = navItems.filter((item) => user && item.roles.includes(user.role));

//   // ✅ FIX: Updated to use signOut (async)
//   const handleLogout = async () => {
//     await signOut();
//     navigate("/");
//   };

//   // Show loading state while auth is checking
//   if (loading) {
//     return (
//       <div className="flex h-screen items-center justify-center">
//         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
//       </div>
//     );
//   }

//   return (
//     <div className="flex h-screen overflow-hidden">
//       {/* Mobile overlay */}
//       <AnimatePresence>
//         {mobileOpen && (
//           <motion.div
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             exit={{ opacity: 0 }}
//             className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-40 lg:hidden"
//             onClick={() => setMobileOpen(false)}
//           />
//         )}
//       </AnimatePresence>

//       {/* Sidebar */}
//       <motion.aside
//         className={cn(
//           "fixed lg:relative z-50 h-full gradient-sidebar flex flex-col transition-all duration-300",
//           collapsed ? "w-[72px]" : "w-64",
//           mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
//         )}
//       >
//         {/* Logo */}
//         <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
//           <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
//             <Zap className="w-5 h-5 text-primary-foreground" />
//           </div>
//           {!collapsed && (
//             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
//               <h1 className="font-display font-bold text-sidebar-primary-foreground text-sm leading-tight">
//                 Brihaspathi
//               </h1>
//               <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">Field Service</p>
//             </motion.div>
//           )}
//           <button
//             onClick={() => setMobileOpen(false)}
//             className="ml-auto lg:hidden text-sidebar-foreground hover:text-sidebar-primary-foreground"
//           >
//             <X className="w-5 h-5" />
//           </button>
//         </div>

//         {/* Nav Items */}
//         <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
//           {visibleNavItems.map((item) => (
//             <NavLink
//               key={item.to}
//               to={item.to}
//               onClick={() => setMobileOpen(false)}
//               className={({ isActive }) =>
//                 cn(
//                   "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
//                   isActive
//                     ? "bg-sidebar-primary/20 text-sidebar-primary"
//                     : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
//                 )
//               }
//             >
//               <item.icon className={cn("w-5 h-5 flex-shrink-0", location.pathname === item.to && "drop-shadow-sm")} />
//               {!collapsed && <span>{item.label}</span>}
//               {location.pathname === item.to && !collapsed && (
//                 <motion.div
//                   layoutId="activeNav"
//                   className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary"
//                 />
//               )}
//             </NavLink>
//           ))}
//         </nav>

//         {/* Bottom */}
//         <div className="p-2 border-t border-sidebar-border">
//           <button
//             className="hidden lg:flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
//             onClick={() => setCollapsed(!collapsed)}
//           >
//             {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
//             {!collapsed && <span>Collapse</span>}
//           </button>
//           <button
//             onClick={handleLogout}
//             className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
//           >
//             <LogOut className="w-5 h-5" />
//             {!collapsed && <span>Logout</span>}
//           </button>
//         </div>
//       </motion.aside>

//       {/* Main content */}
//       <div className="flex-1 flex flex-col overflow-hidden">
//         {/* Top bar */}
//         <header className="h-16 border-b border-border bg-card/80 backdrop-blur-xl flex items-center px-4 lg:px-6 gap-4 flex-shrink-0">
//           <button
//             onClick={() => setMobileOpen(true)}
//             className="lg:hidden text-muted-foreground hover:text-foreground"
//           >
//             <Menu className="w-6 h-6" />
//           </button>
//           <div className="flex-1" />
//           <div className="flex items-center gap-3">
//             <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
//               {user?.avatar ?? "?"}
//             </div>
//             <div className="hidden sm:block">
//               <p className="text-sm font-medium">{user?.name ?? "Guest"}</p>
//               <p className="text-xs text-muted-foreground">{user ? roleLabels[user.role] : ""}</p>
//             </div>
//           </div>
//         </header>

//         {/* Page content */}
//         <main className="flex-1 overflow-y-auto p-4 lg:p-6">
//           <motion.div
//             key={location.pathname}
//             initial={{ opacity: 0, y: 12 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.3, ease: "easeOut" }}
//           >
//             {children}
//           </motion.div>
//         </main>
//       </div>
//     </div>
//   );
// }

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  User,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  // 🔐 Role-based menu items
  const getMenuItems = () => {
    const baseItems = [
      { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "supervisor", "technician", "customer"] },
    ];

    const adminSupervisorItems = [
      { path: "/complaints", label: "All Complaints", icon: FileText, roles: ["admin", "supervisor"] },
      { path: "/assignments", label: "Assignments", icon: Users, roles: ["admin", "supervisor"] },
    ];

    const adminOnlyItems = [
      { path: "/kpi", label: "KPI Analytics", icon: BarChart3, roles: ["admin"] },
    ];

    const commonItems = [
      { path: "/profile", label: "Profile", icon: User, roles: ["admin", "supervisor", "technician", "customer"] },
    ];

    const allItems = [...baseItems, ...adminSupervisorItems, ...adminOnlyItems, ...commonItems];

    // Filter items based on user role
    return allItems.filter(item => user?.role && item.roles.includes(user.role));
  };

  const menuItems = getMenuItems();

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-40 h-screen w-64 transform transition-transform bg-card border-r border-border ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <div>
                <h1 className="font-display font-bold text-lg">Brihaspathi</h1>
                <p className="text-xs text-muted-foreground">Field Service</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                    ? "gradient-primary text-primary-foreground shadow-glow"
                    : "text-foreground hover:bg-accent"
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full gradient-cool flex items-center justify-center text-white font-bold">
                {user?.avatar || user?.name?.charAt(0) || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileMenuOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Main Content */}
      <main className="md:ml-64 p-6 md:p-8">
        {children}
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}