import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { signIn, user, loading: authLoading } = useAuth();

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Note: If you see "WebCrypto API is not supported" in the console, this is a harmless Supabase client fallback for older environments and can be safely ignored.
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      // 📢 Remind to add http://localhost:8080/update-password (and LAN IP equivalent) in Supabase Dashboard -> Auth -> URL Configuration
      // Also configure Site URL: http://localhost:8080 (or production URL when deployed)
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent! Check your inbox.");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error: any) {
      console.error("Forgot Password error:", error);
      // Catch Supabase security rate limit (429 Too Many Requests)
      // To test freely, increase the "Recover / Password Reset rate limit" under Authentication -> Settings -> Rate Limits in the Supabase Dashboard.
      if (error.status === 429 || error.message?.includes("429") || error.message?.toLowerCase().includes("rate limit") || error.message?.toLowerCase().includes("too many requests")) {
        toast.error("Too many requests. Please wait a few minutes before trying again, or contact support.");
      } else {
        toast.error(error.message || "Failed to send reset email");
      }
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    // 1. Check for query parameter errors (like expired reset links)
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorDesc = params.get("error_description");
    if (error) {
      toast.error(errorDesc || "Authentication error occurred.");
      // Clean the URL query parameters
      navigate("/", { replace: true });
      return;
    }

    const forgot = params.get("forgot-password");
    if (forgot === "true") {
      setShowForgotPassword(true);
    }

    // 2. Redirect logged-in users to the dashboard (unless in recovery mode)
    if (!authLoading && user) {
      const isRecovery = window.location.hash.includes("type=recovery") || 
                         window.location.href.includes("type=recovery") ||
                         window.location.search.includes("code=") ||
                         window.location.search.includes("type=recovery");
      if (!isRecovery) {
        navigate("/dashboard");
      }
    }
  }, [user, authLoading, navigate]);

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

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Gradient Hero */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden items-center justify-center p-12">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-blue-400 filter blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-emerald-400 filter blur-3xl animate-float-delayed" />
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-white/10"
              style={{
                width: `${200 + i * 120}px`,
                height: `${200 + i * 120}px`,
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
              animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.05, 0.15] }}
              transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center text-primary-foreground max-w-lg"
        >
          <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-glow animate-float">
            <Zap className="w-10 h-10 text-white fill-white/10" />
          </div>
          <h1 className="text-4xl xl:text-5xl font-display font-extrabold tracking-tight mb-4">
            Field Service Management
          </h1>
          <p className="text-white/80 text-lg font-normal leading-relaxed">
            Elevating field service operations with real-time analytics, automated technician dispatch, and dynamic, data-driven workflows.
          </p>
        </motion.div>
      </div>

      {/* Right Panel - Secure Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 md:p-16 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Brand Logo for Mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-extrabold text-2xl tracking-tight text-gradient">Brihaspathi FSM</span>
          </div>

          <div className="space-y-2">
            <div className="mb-5 flex justify-start">
              <img src="/highbtlogo-tm-1.webp" alt="Brihaspathi Technologies" className="h-14 object-contain" />
            </div>
            <h2 className="text-3xl font-display font-extrabold tracking-tight text-foreground">Welcome Back</h2>
            <p className="text-muted-foreground text-sm">Enter your credentials to access the Field Service Console.</p>
          </div>

          {/* Secure Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12 rounded-xl border-border/80 focus:border-primary focus:ring-primary/20 bg-card"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 pr-11 h-12 rounded-xl border-border/80 focus:border-primary focus:ring-primary/20 bg-card"
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs font-semibold text-primary hover:underline hover:text-primary/80 transition-colors"
                disabled={loading}
              >
                Forgot Password?
              </button>
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl gradient-primary text-white font-bold shadow-glow hover:opacity-95 transition-all mt-2"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Authenticating...
                </span>
              ) : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground font-medium pt-4">
            © 2026 Brihaspathi Technologies Ltd. All rights reserved.
          </p>
        </motion.div>
      </div>

      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border/80 p-6 sm:p-8 rounded-2xl max-w-md w-full shadow-2xl space-y-6 relative overflow-hidden"
          >
            {/* Background elements */}
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/10 filter blur-2xl" />
            
            <div className="space-y-2">
              <h2 className="text-2xl font-display font-extrabold tracking-tight text-foreground">Reset Password</h2>
              <p className="text-sm text-muted-foreground">
                Enter your email address and we'll send you a secure link to reset your password.
              </p>
            </div>

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="pl-11 h-12 rounded-xl border-border/80 focus:border-primary focus:ring-primary/20 bg-background"
                    required
                    disabled={resetLoading}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 h-11 rounded-xl"
                  disabled={resetLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 h-11 rounded-xl gradient-primary text-white font-bold"
                >
                  {resetLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Sending...
                    </span>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Login;