// import { Link, useLocation, useNavigate } from "react-router-dom";
// import { useAuth } from "@/contexts/AuthContext";
// import {
//   LayoutDashboard,
//   FileText,
//   Users,
//   BarChart3,
//   User,
//   LogOut,
//   Menu,
//   X
// } from "lucide-react";
// import { useState } from "react";
// import { Button } from "@/components/ui/button";

// export function AppLayout({ children }: { children: React.ReactNode }) {
//   const { user, signOut } = useAuth();
//   const location = useLocation();
//   const navigate = useNavigate();
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

//   const handleLogout = async () => {
//     await signOut();
//     navigate("/");
//   };

//   // 🔐 Role-based menu items
//   const getMenuItems = () => {
//     const baseItems = [
//       { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "supervisor", "technician", "customer"] },
//     ];

//     const adminSupervisorItems = [
//       { path: "/complaints", label: "All Complaints", icon: FileText, roles: ["admin", "supervisor"] },
//       { path: "/assignments", label: "Assignments", icon: Users, roles: ["admin", "supervisor"] },
//     ];

//     const adminOnlyItems = [
//       { path: "/kpi", label: "KPI Analytics", icon: BarChart3, roles: ["admin"] },
//     ];

//     const commonItems = [
//       { path: "/profile", label: "Profile", icon: User, roles: ["admin", "supervisor", "technician", "customer"] },
//     ];

//     const allItems = [...baseItems, ...adminSupervisorItems, ...adminOnlyItems, ...commonItems];

//     // Filter items based on user role
//     return allItems.filter(item => user?.role && item.roles.includes(user.role));
//   };

//   const menuItems = getMenuItems();

//   return (
//     <div className="min-h-screen bg-background">
//       {/* Sidebar */}
//       <aside className={`fixed top-0 left-0 z-40 h-screen w-64 transform transition-transform bg-card border-r border-border ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
//         } md:translate-x-0`}>
//         <div className="flex flex-col h-full">
//           {/* Logo */}
//           <div className="flex items-center justify-between p-6 border-b border-border">
//             <div className="flex items-center gap-2">
//               <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
//                 <span className="text-white font-bold text-sm">B</span>
//               </div>
//               <div>
//                 <h1 className="font-display font-bold text-lg">Brihaspathi</h1>
//                 <p className="text-xs text-muted-foreground">Field Service</p>
//               </div>
//             </div>
//             <Button
//               variant="ghost"
//               size="sm"
//               className="md:hidden"
//               onClick={() => setMobileMenuOpen(false)}
//             >
//               <X className="w-4 h-4" />
//             </Button>
//           </div>

//           {/* Navigation */}
//           <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
//             {menuItems.map((item) => {
//               const Icon = item.icon;
//               const isActive = location.pathname === item.path;

//               return (
//                 <Link
//                   key={item.path}
//                   to={item.path}
//                   onClick={() => setMobileMenuOpen(false)}
//                   className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
//                     ? "gradient-primary text-primary-foreground shadow-glow"
//                     : "text-foreground hover:bg-accent"
//                     }`}
//                 >
//                   <Icon className="w-5 h-5" />
//                   <span className="font-medium">{item.label}</span>
//                 </Link>
//               );
//             })}
//           </nav>

//           {/* User Info & Logout */}
//           <div className="p-4 border-t border-border">
//             <div className="flex items-center gap-3 mb-3">
//               <div className="w-10 h-10 rounded-full gradient-cool flex items-center justify-center text-white font-bold">
//                 {user?.avatar || user?.name?.charAt(0) || "U"}
//               </div>
//               <div className="flex-1 min-w-0">
//                 <p className="font-medium text-sm truncate">{user?.name}</p>
//                 <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
//               </div>
//             </div>
//             <Button
//               variant="outline"
//               size="sm"
//               className="w-full"
//               onClick={handleLogout}
//             >
//               <LogOut className="w-4 h-4 mr-2" />
//               Logout
//             </Button>
//           </div>
//         </div>
//       </aside>

//       {/* Mobile Menu Button */}
//       <Button
//         variant="ghost"
//         size="sm"
//         className="fixed top-4 left-4 z-50 md:hidden"
//         onClick={() => setMobileMenuOpen(true)}
//       >
//         <Menu className="w-5 h-5" />
//       </Button>

//       {/* Main Content */}
//       <main className="md:ml-64 p-6 md:p-8">
//         {children}
//       </main>

//       {/* Mobile Overlay */}
//       {mobileMenuOpen && (
//         <div
//           className="fixed inset-0 bg-black/50 z-30 md:hidden"
//           onClick={() => setMobileMenuOpen(false)}
//         />
//       )}
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
  X,
  Plus,
  UserPlus,
  Zap,
  ChevronLeft,
  ChevronRight,
  Settings
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationCenter } from "./NotificationCenter";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "true");

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  // Close menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const getAvatarInitial = (name?: string, email?: string) => {
    if (name && name.length > 0) {
      return name.charAt(0).toUpperCase();
    }
    if (email && email.length > 0) {
      return email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const getMenuItems = () => {
    const baseItems = [
      { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "supervisor", "technician", "customer"] },
      { path: "/complaints", label: "All Complaints", icon: FileText, roles: ["admin", "supervisor"] },
    ];

    const adminSupervisorItems = [
      { path: "/assignments", label: "Assignments", icon: Users, roles: ["admin", "supervisor"] },
    ];

    const adminOnlyItems = [
      { path: "/kpi", label: "KPI Analytics", icon: BarChart3, roles: ["admin"] },
      { path: "/admin/users", label: "User Management", icon: UserPlus, roles: ["admin"] },
    ];

    const allItems = [
      ...baseItems,
      ...adminSupervisorItems,
      ...adminOnlyItems
    ];
    return allItems.filter(item => user?.role && item.roles.includes(user.role));
  };

  const menuItems = getMenuItems();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden relative">
      {/* 🔥 Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 🔥 Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-[100dvh] transform transition-all duration-300 ease-in-out bg-[#f8fafc] text-slate-800 border-r border-slate-200/80 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 ${sidebarCollapsed ? "md:w-20" : "md:w-64"} w-64`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-5 border-b border-slate-200/80 relative">
            <div className="flex items-center gap-2.5 min-w-0 w-full">
              {sidebarCollapsed ? (
                <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shadow-black/10 shrink-0 border border-slate-100">
                  <img src="/Brihaspthilogo.ico" alt="Logo" className="w-7 h-7 object-contain" />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 shrink-0 align-start w-full">
                  <div className="flex items-center justify-start shrink-0 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80 shadow-sm max-w-[150px]">
                    <img src="/highbtlogo-tm-1.webp" alt="Logo" className="h-5.5 w-auto object-contain" />
                  </div>
                  <p className="text-xs uppercase font-black tracking-wider text-[#0083a2] pl-0.5 mt-2">
                    Field Service Management
                  </p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-slate-500 hover:text-slate-900 hover:bg-slate-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    sidebarCollapsed ? "md:justify-center md:px-0" : ""
                  } ${isActive
                    ? "bg-[#0083a2] text-white shadow-sm font-semibold"
                    : "text-slate-600 hover:text-[#0083a2] hover:bg-slate-200/40"
                    }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && <span className="text-sm font-medium transition-all duration-300 truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-slate-200 bg-slate-100/30">
            {/* User card link to Profile */}
            <Link 
              to="/profile"
              className={`flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors relative ${
                sidebarCollapsed ? "md:justify-center md:p-1.5" : ""
              }`}
            >
              <div className="w-9 h-9 rounded-full gradient-cool flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
                {getAvatarInitial(user?.name, user?.email)}
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0 transition-all duration-300">
                  <p className="font-bold text-xs text-slate-800 truncate">
                    {user?.role === "admin" ? "Admin" : user?.name || "User"}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 capitalize truncate">
                    {user?.role === "admin" ? "Admin" : user?.role}
                  </p>
                </div>
              )}
            </Link>

            {/* Logout button like old */}
            <Button
              variant="outline"
              size="sm"
              className={`w-full rounded-xl border-slate-200 bg-white hover:bg-destructive hover:text-white text-slate-600 hover:border-destructive transition-all mt-3 ${
                sidebarCollapsed ? "md:p-0 md:h-9 flex items-center justify-center" : ""
              }`}
              onClick={handleLogout}
              title={sidebarCollapsed ? "Logout" : undefined}
            >
              <LogOut className={`w-4 h-4 ${sidebarCollapsed ? "" : "mr-2"}`} />
              {!sidebarCollapsed && "Logout"}
            </Button>

            {/* Collapse Button */}
            <button
              onClick={toggleSidebar}
              className={`flex items-center gap-2.5 w-full px-2.5 py-2 mt-3 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/40 transition-colors font-bold text-xs ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 shrink-0" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 shrink-0" />
                  Collapse
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* 🔥 FIXED: Hamburger Menu Button - Always visible on mobile */}
      <button
        type="button"
        onClick={() => setMobileMenuOpen(true)}
        className="fixed top-4 left-4 z-30 md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-background border border-border shadow-sm hover:bg-accent transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* 🔥 Notification Center - Floating in top-right */}
      <div className="fixed top-4 right-4 md:top-5 md:right-6 z-40">
        <NotificationCenter />
      </div>

      {/* 🔥 Main Content - Proper spacing */}
      <main className={`transition-all duration-300 min-h-screen px-4 py-6 md:p-8 pt-20 md:pt-8 ${
        sidebarCollapsed ? "md:ml-20" : "md:ml-64"
      }`}>
        {children}
      </main>
    </div>
  );
}