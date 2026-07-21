// import { useState } from "react";
// import { motion } from "framer-motion";
// import { User, Mail, Phone, Shield, Bell, Save, Wrench } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Switch } from "@/components/ui/switch";
// import { useAuth } from "@/contexts/AuthContext";
// import { toast } from "sonner";

// const roleLabels: Record<string, string> = {
//   admin: "Administrator",
//   supervisor: "Supervisor",
//   technician: "Field Technician",
//   customer: "Customer",
// };

// const Profile = () => {
//   const { user } = useAuth();

//   const [profile, setProfile] = useState({
//     name: user?.name ?? "",
//     email: user?.email ?? "",
//     phone: user?.phone ?? "",
//     role: user ? roleLabels[user.role] : "",
//     expertise: user?.expertise ?? "",
//   });

//   const handleSave = () => {
//     toast.success("Profile updated successfully!");
//   };

//   return (
//     <div className="space-y-6 max-w-3xl">
//       <div>
//         <h1 className="text-2xl font-display font-bold">Profile</h1>
//         <p className="text-muted-foreground">Manage your account settings</p>
//       </div>

//       {/* Profile Card */}
//       <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6">
//         <div className="flex items-center gap-5 mb-8">
//           <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
//             {user?.avatar ?? "?"}
//           </div>
//           <div>
//             <h2 className="text-xl font-display font-bold">{profile.name}</h2>
//             <p className="text-muted-foreground">{profile.role}</p>
//             {profile.expertise && (
//               <p className="text-sm text-primary flex items-center gap-1 mt-1">
//                 <Wrench className="w-3.5 h-3.5" /> {profile.expertise}
//               </p>
//             )}
//           </div>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div className="space-y-2">
//             <label className="text-sm font-medium flex items-center gap-2"><User className="w-3.5 h-3.5 text-muted-foreground" /> Full Name</label>
//             <Input value={profile.name} onChange={(e) => setProfile({...profile, name: e.target.value})} />
//           </div>
//           <div className="space-y-2">
//             <label className="text-sm font-medium flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email</label>
//             <Input value={profile.email} onChange={(e) => setProfile({...profile, email: e.target.value})} />
//           </div>
//           <div className="space-y-2">
//             <label className="text-sm font-medium flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> Phone</label>
//             <Input value={profile.phone} onChange={(e) => setProfile({...profile, phone: e.target.value})} />
//           </div>
//           <div className="space-y-2">
//             <label className="text-sm font-medium flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-muted-foreground" /> Role</label>
//             <Input value={profile.role} disabled className="opacity-60" />
//           </div>
//         </div>

//         <Button onClick={handleSave} className="mt-6 gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
//           <Save className="w-4 h-4 mr-2" /> Save Changes
//         </Button>
//       </motion.div>

//       {/* Notifications */}
//       <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-xl p-6">
//         <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
//           <Bell className="w-4 h-4 text-primary" /> Notification Preferences
//         </h2>
//         <div className="space-y-4">
//           {[
//             { label: "New ticket assignments", desc: "Get notified when tickets are assigned to you" },
//             { label: "Status updates", desc: "Updates when ticket status changes" },
//             { label: "Urgent alerts", desc: "Immediate alerts for major severity tickets" },
//             { label: "Daily digest", desc: "Daily summary of all activities" },
//           ].map((item, i) => (
//             <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
//               <div>
//                 <p className="text-sm font-medium">{item.label}</p>
//                 <p className="text-xs text-muted-foreground">{item.desc}</p>
//               </div>
//               <Switch defaultChecked={i < 3} />
//             </div>
//           ))}
//         </div>
//       </motion.div>
//     </div>
//   );
// };

// export default Profile;


import { useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone, Shield, Bell, Save, Wrench, Edit, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  technician: "Field Technician",
  customer: "Customer",
};

const Profile = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [profile, setProfile] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user ? roleLabels[user.role] : "",
    expertise: user?.expertise ?? "",
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Password visibility states
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Extract first letter of name for avatar with better fallback
  const getAvatarInitial = (name: string, email?: string) => {
    if (name && name.length > 0) {
      return name.charAt(0).toUpperCase();
    }
    if (email && email.length > 0) {
      return email.charAt(0).toUpperCase();
    }
    return "?";
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in to update your profile.");
      return;
    }
    if (!profile.name.trim()) {
      toast.error("Full Name cannot be empty.");
      return;
    }
    if (!profile.email.trim()) {
      toast.error("Email cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.name.trim(),
          email: profile.email.trim(),
          phone: profile.phone?.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      setIsEditing(false);
      
      // Auto-reload after a delay to ensure context refreshes profile state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setIsUpdatingPassword(true);
      
      // Verify current password by signing in with the user's email and current password
      const userEmail = user?.email || profile.email;
      if (!userEmail) {
        throw new Error("Unable to determine your email address to verify password.");
      }
      
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (verifyError) {
        throw new Error("Incorrect current password. Please try again.");
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPass(false);
      setShowNewPass(false);
      setShowConfirmPass(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-display font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-8 pb-6 border-b">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
              {getAvatarInitial(profile.name, profile.email)}
            </div>
            <div>
              <h2 className="text-xl font-display font-bold">{profile.name}</h2>
              <p className="text-muted-foreground">{profile.role}</p>
              {profile.expertise && (
                <p className="text-sm text-primary flex items-center gap-1 mt-1">
                  <Wrench className="w-3.5 h-3.5" /> {profile.expertise}
                </p>
              )}
            </div>
          </div>
          
          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 self-start sm:self-center"
            >
              <Edit className="w-4 h-4" /> Edit Profile
            </Button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground" /> Full Name
              </label>
              <Input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                disabled={!isEditing || isSaving}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email
              </label>
              <Input
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                disabled={!isEditing || isSaving}
                type="email"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Phone
              </label>
              <Input
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                disabled={!isEditing || isSaving}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-muted-foreground" /> Role
              </label>
              <Input value={profile.role} disabled className="opacity-60" />
            </div>
          </div>

          {isEditing && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setProfile({
                    name: user?.name ?? "",
                    email: user?.email ?? "",
                    phone: user?.phone ?? "",
                    role: user ? roleLabels[user.role] : "",
                    expertise: user?.expertise ?? "",
                  });
                  setIsEditing(false);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </form>
      </motion.div>

      {/* Change Password Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.1 }}
        className="glass-card rounded-xl p-6"
      >
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> Change Password
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Password</label>
            <div className="relative">
              <Input 
                type={showCurrentPass ? "text" : "password"} 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
                placeholder="Enter current password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPass ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <div className="relative">
              <Input 
                type={showNewPass ? "text" : "password"} 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder="Minimum 6 characters"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPass ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm New Password</label>
            <div className="relative">
              <Input 
                type={showConfirmPass ? "text" : "password"} 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="Confirm new password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPass ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>
          <Button 
            type="submit" 
            disabled={isUpdatingPassword}
            className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90 mt-2"
          >
            {isUpdatingPassword ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...
              </>
            ) : "Update Password"}
          </Button>
        </form>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-xl p-6">
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Notification Preferences
        </h2>
        <div className="space-y-4">
          {[
            { label: "New ticket assignments", desc: "Get notified when tickets are assigned to you" },
            { label: "Status updates", desc: "Updates when ticket status changes" },
            { label: "Urgent alerts", desc: "Immediate alerts for major severity tickets" },
            { label: "Daily digest", desc: "Daily summary of all activities" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch defaultChecked={i < 3} />
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;