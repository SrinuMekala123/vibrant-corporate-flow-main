import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, Eye, EyeOff, Loader2, ArrowLeft, ShieldAlert, Sparkles, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

/**
 * 🔒 Supabase Auth URL Configuration Settings Reminder:
 * Please configure the following settings in your Supabase Dashboard:
 * 1. Go to Authentication -> URL Configuration
 * 2. Set Site URL:
 *    - http://localhost:8080 (or your production domain when deployed)
 * 3. Additional Redirect URLs must include:
 *    - http://localhost:8080/update-password
 *    - http://172.21.6.206:8080/update-password (for LAN / network testing)
 *    - Production URL equivalents when deployed
 */

// Global lock for concurrent PKCE code exchanges
let globalCodeExchangePromise: Promise<any> | null = null;

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlError = params.get("error");
        if (urlError) {
          console.warn("Found error query param in recovery URL:", urlError);
          if (isMounted) {
            setIsValidSession(false);
            setCheckingSession(false);
          }
          return;
        }

        // Check if there is a 'code' parameter to exchange for a session (PKCE)
        const code = params.get("code");
        if (code) {
          if (!globalCodeExchangePromise) {
            console.log("PKCE flow detected. Exchanging code for session...");
            globalCodeExchangePromise = supabase.auth.exchangeCodeForSession(code);
          } else {
            console.log("PKCE code exchange already in progress/completed. Awaiting existing promise...");
          }
          const { error: exchangeError } = await globalCodeExchangePromise;
          if (exchangeError) {
            console.error("Code exchange failed:", exchangeError);
            // Reset global promise on failure to allow re-attempts
            globalCodeExchangePromise = null;
            if (isMounted) {
              setIsValidSession(false);
              setCheckingSession(false);
            }
            return;
          }
          console.log("Code exchange successful, session established!");
          // Clean up URL query parameters to avoid double-processing on page reloads/Strict Mode remounts
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        const isRecoveryUrl = window.location.hash.includes("type=recovery") || 
                             window.location.hash.includes("access_token=") ||
                             window.location.search.includes("type=recovery") ||
                             window.location.search.includes("code=") ||
                             window.location.href.includes("recovery");

        if (session && session.user && session.user.aud === "authenticated") {
          if (isMounted) {
            setIsValidSession(true);
            setCheckingSession(false);
          }
        } else if (!isRecoveryUrl) {
          if (isMounted) {
            setIsValidSession(false);
            setCheckingSession(false);
          }
        }
      } catch (err) {
        console.error("Session verification failed:", err);
        if (isMounted) {
          setIsValidSession(false);
          setCheckingSession(false);
        }
      }
    };

    verifySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      console.log("Auth State Change Event inside UpdatePassword:", event);

      if (event === "PASSWORD_RECOVERY" || (session && session.user && session.user.aud === "authenticated")) {
        setIsValidSession(true);
        setCheckingSession(false);
      }
    });

    const timer = setTimeout(() => {
      if (isMounted && checkingSession) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session || !session.user || session.user.aud !== "authenticated") {
            setIsValidSession(false);
            setCheckingSession(false);
          }
        });
      }
    }, 2500);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setUpdating(true);
    console.log("Password update initiated...");
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Password update request timed out (30s limit). Please check your connection and try again.")), 30000)
      );

      const updatePromise = (async () => {
        console.log("Calling supabase.auth.updateUser...");
        const result = await supabase.auth.updateUser({ password: newPassword });
        console.log("supabase.auth.updateUser completed successfully:", result);
        return result;
      })();

      const result = await Promise.race([updatePromise, timeoutPromise]) as any;

      if (result.error) {
        console.error("Supabase auth error during password update:", result.error);
        throw result.error;
      }

      console.log("Password updated successfully. Logging out recovery session...");
      toast.success("Password updated successfully! Redirecting to login...");

      // Attempt signout but catch any issues to avoid blocking the user flow
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.warn("Signout during password update cleanup failed (non-critical):", signOutErr);
      }

      console.log("Redirecting user to login page.");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Password update error caught:", err);
      toast.error(err.message || "Failed to update password. Link might be expired.");
    } finally {
      setUpdating(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-slate-400 font-medium">Verifying password recovery session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Corporate Gradient Hero */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden items-center justify-center p-12">
        {/* Decorative background vectors */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-white/20 filter blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-400/20 filter blur-3xl" />
        </div>
        
        {/* Hero Card Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-lg text-white"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-glow">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-extrabold text-3xl tracking-tight">Brihaspathi FSM</span>
          </div>

          <h1 className="text-5xl font-display font-extrabold tracking-tight mb-6 leading-[1.15]">
            Secure Access Recovery
          </h1>
          <p className="text-white/80 text-lg font-normal leading-relaxed">
            Establish new, secure authentication credentials to safely access the Field Service Console.
          </p>
        </motion.div>
      </div>

      {/* Right Panel - Secure Form Screen */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 md:p-16 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Mobile Logo Header */}
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
            <h2 className="text-3xl font-display font-extrabold tracking-tight text-foreground">
              {isValidSession ? "Update Password" : "Reset Link Status"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isValidSession 
                ? "Choose a strong password to protect your supervisor or technician credentials."
                : "Invalid or expired link. Please request a new reset link."}
            </p>
          </div>

          {!isValidSession ? (
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-destructive">Verification Failed</p>
                  <p className="text-muted-foreground mt-1 leading-normal">
                    This password reset link is invalid, expired, or has already been used. Please request a new link to proceed.
                  </p>
                </div>
              </div>
              
              <Button
                className="w-full gradient-primary text-white font-bold h-12 rounded-xl shadow-glow transition-all duration-300 hover:opacity-95"
                onClick={() => navigate("/?forgot-password=true")}
              >
                <Sparkles className="w-4 h-4 mr-2" /> Request New Reset Link
              </Button>

              <Button
                variant="outline"
                className="w-full border-border/80 hover:bg-muted text-foreground h-12 rounded-xl font-medium"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="pl-11 pr-11 h-12 rounded-xl border-border/80 focus:border-primary focus:ring-primary/20 bg-card text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirm New Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="pl-11 pr-11 h-12 rounded-xl border-border/80 focus:border-primary focus:ring-primary/20 bg-card text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {/* Action Button */}
              <Button
                type="submit"
                disabled={updating}
                className="w-full gradient-primary hover:opacity-95 text-white font-bold h-12 rounded-xl shadow-glow text-base transition-all duration-300"
              >
                {updating ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Saving Password...
                  </span>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default UpdatePassword;
