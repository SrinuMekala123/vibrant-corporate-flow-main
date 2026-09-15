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

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && session.user) {
          if (isMounted) {
            setIsValidSession(true);
            setCheckingSession(false);
          }
          return;
        }

        // Wait briefly for detectSessionInUrl to finish processing recovery tokens
        let attempts = 0;
        const maxAttempts = 10;
        const delayMs = 300;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          
          if (retrySession?.user) {
            if (isMounted) {
              setIsValidSession(true);
              setCheckingSession(false);
            }
            return;
          }
          attempts++;
        }

        if (isMounted) {
          setIsValidSession(false);
          setCheckingSession(false);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      console.log("Auth State Change Event inside UpdatePassword:", event);

      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session?.user) {
        setIsValidSession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
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
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const hasOtp = trimmedEmail.length > 0 || otpCode.length > 0;

      if (hasOtp) {
        if (!trimmedEmail || !/^\d{6}$/.test(otpCode)) {
          toast.error("Enter your email and the 6-digit verification code.");
          return;
        }

        const { error: otpError } = await supabase.auth.verifyOtp({
          email: trimmedEmail,
          token: otpCode,
          type: "recovery",
        });

        if (otpError) {
          throw new Error("The verification code is invalid or expired. Please request a new reset email.");
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error("Your password reset session has expired. Please request a new reset email.");
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      toast.success("Password updated successfully! Redirecting to login...");

      // Cleanup must never delay or mask a successful password update.
      void supabase.auth.signOut().catch((signOutErr) => {
        console.warn("Signout during password update cleanup failed (non-critical):", signOutErr);
      });
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

          {!isValidSession && (
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
              
            </div>
          )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address <span className="normal-case font-normal">(for code recovery)</span></label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={updating}
                  className="w-full h-12 rounded-xl border-border/80 bg-card text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Verification Code</label>
                <Input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  disabled={updating}
                  className="w-full h-12 rounded-xl border-border/80 bg-card text-foreground tracking-[0.3em]"
                />
                <p className="text-xs text-muted-foreground">Click the link in your email, or enter the 6-digit code below:</p>
              </div>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-border/70" />
                <span className="mx-3 text-xs text-muted-foreground">Or use your reset link</span>
                <div className="flex-grow border-t border-border/70" />
              </div>

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
        </motion.div>
      </div>
    </div>
  );
};

export default UpdatePassword;
