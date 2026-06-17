import { useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone, Shield, Bell, Save, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  technician: "Field Technician",
  customer: "Customer",
};

const Profile = () => {
  const { user } = useAuth();

  const [profile, setProfile] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user ? roleLabels[user.role] : "",
    expertise: user?.expertise ?? "",
  });

  const handleSave = () => {
    toast.success("Profile updated successfully!");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-5 mb-8">
          <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
            {user?.avatar ?? "?"}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2"><User className="w-3.5 h-3.5 text-muted-foreground" /> Full Name</label>
            <Input value={profile.name} onChange={(e) => setProfile({...profile, name: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email</label>
            <Input value={profile.email} onChange={(e) => setProfile({...profile, email: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> Phone</label>
            <Input value={profile.phone} onChange={(e) => setProfile({...profile, phone: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-muted-foreground" /> Role</label>
            <Input value={profile.role} disabled className="opacity-60" />
          </div>
        </div>

        <Button onClick={handleSave} className="mt-6 gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
          <Save className="w-4 h-4 mr-2" /> Save Changes
        </Button>
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
