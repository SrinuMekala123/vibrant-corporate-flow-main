// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { motion } from "framer-motion";
// import { Zap, Mail, Lock, Eye, EyeOff, ChevronDown } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { useAuth, mockUsers, UserRole } from "@/contexts/AuthContext";
// import { toast } from "sonner";

// const roleColors: Record<UserRole, string> = {
//   admin: "gradient-primary",
//   supervisor: "gradient-cool",
//   technician: "gradient-warm",
//   customer: "bg-muted",
// };

// const roleLabels: Record<UserRole, string> = {
//   admin: "Administrator",
//   supervisor: "Supervisor",
//   technician: "Field Technician",
//   customer: "Customer",
// };

// const Login = () => {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPass, setShowPass] = useState(false);
//   const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
//   const navigate = useNavigate();
//   const { login } = useAuth();

//   const filteredUsers = selectedRole ? mockUsers.filter((u) => u.role === selectedRole) : [];

//   const handleLogin = (e: React.FormEvent) => {
//     e.preventDefault();
//     const success = login(email);
//     if (success) {
//       toast.success("Logged in successfully!");
//       navigate("/dashboard");
//     } else {
//       toast.error("Invalid email. Try selecting a user below.");
//     }
//   };

//   const handleQuickLogin = (userEmail: string) => {
//     setEmail(userEmail);
//     const success = login(userEmail);
//     if (success) {
//       toast.success("Logged in successfully!");
//       navigate("/dashboard");
//     }
//   };

//   return (
//     <div className="min-h-screen flex">
//       {/* Left Panel - Gradient Hero */}
//       <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden items-center justify-center p-12">
//         <div className="absolute inset-0 opacity-10">
//           {[...Array(6)].map((_, i) => (
//             <motion.div
//               key={i}
//               className="absolute rounded-full border border-primary-foreground/20"
//               style={{
//                 width: `${200 + i * 120}px`,
//                 height: `${200 + i * 120}px`,
//                 left: "50%",
//                 top: "50%",
//                 transform: "translate(-50%, -50%)",
//               }}
//               animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
//               transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
//             />
//           ))}
//         </div>
//         <motion.div
//           initial={{ opacity: 0, y: 30 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.8 }}
//           className="relative z-10 text-center"
//         >
//           <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-primary-foreground/10 backdrop-blur-xl flex items-center justify-center border border-primary-foreground/20">
//             <Zap className="w-10 h-10 text-primary-foreground" />
//           </div>
//           <h1 className="text-4xl font-display font-bold text-primary-foreground mb-4">
//             Field Service<br />Management
//           </h1>
//           <p className="text-primary-foreground/70 text-lg max-w-md">
//             Streamline your field operations with data-driven workflows and real-time tracking.
//           </p>
//         </motion.div>
//       </div>

//       {/* Right Panel - Login Form */}
//       <div className="flex-1 flex items-center justify-center p-8 bg-background overflow-y-auto">
//         <motion.div
//           initial={{ opacity: 0, x: 20 }}
//           animate={{ opacity: 1, x: 0 }}
//           transition={{ duration: 0.5, delay: 0.2 }}
//           className="w-full max-w-md"
//         >
//           {/* Mobile logo */}
//           <div className="lg:hidden flex items-center gap-3 mb-10">
//             <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
//               <Zap className="w-5 h-5 text-primary-foreground" />
//             </div>
//             <span className="font-display font-bold text-xl">Brihaspathi FSM</span>
//           </div>

//           <h2 className="text-2xl font-display font-bold mb-2">Welcome back</h2>
//           <p className="text-muted-foreground mb-8">Sign in to your account to continue</p>

//           <form onSubmit={handleLogin} className="space-y-5">
//             <div className="space-y-2">
//               <label className="text-sm font-medium">Email</label>
//               <div className="relative">
//                 <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
//                 <Input
//                   type="email"
//                   placeholder="admin@brihaspathi.com"
//                   value={email}
//                   onChange={(e) => setEmail(e.target.value)}
//                   className="pl-10 h-11"
//                 />
//               </div>
//             </div>
//             <div className="space-y-2">
//               <label className="text-sm font-medium">Password</label>
//               <div className="relative">
//                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
//                 <Input
//                   type={showPass ? "text" : "password"}
//                   placeholder="••••••••"
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   className="pl-10 pr-10 h-11"
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPass(!showPass)}
//                   className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
//                 >
//                   {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
//                 </button>
//               </div>
//             </div>
//             <Button type="submit" className="w-full h-11 gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-90 transition-opacity">
//               Sign In
//             </Button>
//           </form>

//           {/* Quick Login by Role */}
//           <div className="mt-8">
//             <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Quick Login (Demo)</p>
//             <div className="grid grid-cols-2 gap-2 mb-3">
//               {(["admin", "supervisor", "technician", "customer"] as UserRole[]).map((role) => (
//                 <button
//                   key={role}
//                   onClick={() => setSelectedRole(selectedRole === role ? null : role)}
//                   className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-all border ${
//                     selectedRole === role
//                       ? "border-primary bg-primary/10 text-primary"
//                       : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
//                   }`}
//                 >
//                   {roleLabels[role]}
//                 </button>
//               ))}
//             </div>
//             {selectedRole && filteredUsers.length > 0 && (
//               <motion.div
//                 initial={{ opacity: 0, height: 0 }}
//                 animate={{ opacity: 1, height: "auto" }}
//                 className="space-y-2"
//               >
//                 {filteredUsers.map((u) => (
//                   <button
//                     key={u.id}
//                     onClick={() => handleQuickLogin(u.email)}
//                     className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
//                   >
//                     <div className={`w-9 h-9 rounded-full ${roleColors[u.role]} flex items-center justify-center text-xs font-bold text-primary-foreground`}>
//                       {u.avatar}
//                     </div>
//                     <div className="flex-1 min-w-0">
//                       <p className="text-sm font-medium truncate">{u.name}</p>
//                       <p className="text-xs text-muted-foreground truncate">{u.email}</p>
//                     </div>
//                     <ChevronDown className="w-4 h-4 text-muted-foreground rotate-[-90deg]" />
//                   </button>
//                 ))}
//               </motion.div>
//             )}
//           </div>

//           <p className="text-center text-sm text-muted-foreground mt-8">
//             © 2026 Brihaspathi Technologies Ltd.
//           </p>
//         </motion.div>
//       </div>
//     </div>
//   );
// };

// export default Login;


import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, Eye, EyeOff, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { toast } from "sonner";

const roleColors: Record<UserRole, string> = {
  admin: "gradient-primary",
  supervisor: "gradient-cool",
  technician: "gradient-warm",
  customer: "bg-muted",
};

const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  technician: "Field Technician",
  customer: "Customer",
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { signIn, signUp } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      console.error("Login error:", error);
      toast.error(error.message || "Invalid email or password");
    } else {
      toast.success("Welcome back!");
      navigate("/dashboard");
    }
    setLoading(false);
  };

  const handleQuickLogin = async (userEmail: string) => {
    setLoading(true);
    const { error } = await signIn(userEmail, "demo123");
    if (!error) {
      toast.success("Logged in successfully!");
      navigate("/dashboard");
    } else {
      toast.error("Demo login failed. Please sign up or use correct credentials.");
    }
    setLoading(false);
  };

  const handleSignUp = async (role: UserRole) => {
    if (!email || !password) {
      toast.error("Please enter email and password first");
      return;
    }

    setLoading(true);
    const { error } = await signUp(
      email,
      password,
      email.split("@")[0],
      role
    );

    if (error) {
      toast.error(error.message || "Sign up failed");
    } else {
      toast.success("Account created! Please check your email to confirm.");
      navigate("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Gradient Hero */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-primary-foreground/20"
              style={{
                width: `${200 + i * 120}px`,
                height: `${200 + i * 120}px`,
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center"
        >
          <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-primary-foreground/10 backdrop-blur-xl flex items-center justify-center border border-primary-foreground/20">
            <Zap className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-display font-bold text-primary-foreground mb-4">
            Field Service<br />Management
          </h1>
          <p className="text-primary-foreground/70 text-lg max-w-md">
            Streamline your field operations with data-driven workflows and real-time tracking.
          </p>
        </motion.div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">Brihaspathi FSM</span>
          </div>

          <h2 className="text-2xl font-display font-bold mb-2">Welcome back</h2>
          <p className="text-muted-foreground mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11"
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  disabled={loading}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                  Signing in...
                </span>
              ) : "Sign In"}
            </Button>
          </form>

          {/* Quick Login by Role (Demo Only) */}
          {/* <div className="mt-8">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Quick Login (Demo)</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(["admin", "supervisor", "technician", "customer"] as UserRole[]).map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(selectedRole === role ? null : role)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-all border ${selectedRole === role
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                    } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={loading}
                >
                  {roleLabels[role]}
                </button>
              ))}
            </div>
            {selectedRole && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2"
              >
                <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  <p>Enter email above, then click:</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={() => handleSignUp(selectedRole)}
                    disabled={loading || !email}
                  >
                    Sign Up as {roleLabels[selectedRole]}
                  </Button>
                  <p className="mt-2 text-[10px]">
                    Demo password: <code className="bg-muted px-1 rounded">demo123</code>
                  </p>
                </div>
              </motion.div>
            )}
          </div> */}

          <p className="text-center text-sm text-muted-foreground mt-8">
            © 2026 Brihaspathi Technologies Ltd.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;