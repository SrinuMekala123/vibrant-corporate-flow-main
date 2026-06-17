// import { createContext, useContext, useState, ReactNode } from "react";

// export type UserRole = "admin" | "supervisor" | "technician" | "customer";

// export interface AppUser {
//   id: string;
//   name: string;
//   email: string;
//   role: UserRole;
//   avatar: string;
//   expertise?: string;
//   phone?: string;
// }

// export const mockUsers: AppUser[] = [
//   { id: "U-001", name: "Admin User", email: "admin@brihaspathi.com", role: "admin", avatar: "AU", phone: "+91 99000 11122" },
//   { id: "U-002", name: "Rajesh Kumar", email: "rajesh.k@brihaspathi.com", role: "supervisor", avatar: "RK", expertise: "Solar PV, Power Systems", phone: "+91 99887 76655" },
//   { id: "U-003", name: "Priya Sharma", email: "priya.s@brihaspathi.com", role: "supervisor", avatar: "PS", expertise: "Networking, Fiber Optics", phone: "+91 88776 65544" },
//   { id: "U-004", name: "Arjun Nair", email: "arjun.n@brihaspathi.com", role: "supervisor", avatar: "AN", expertise: "Security Systems, CCTV", phone: "+91 77665 54433" },
//   { id: "U-005", name: "Anil Reddy", email: "anil.r@brihaspathi.com", role: "technician", avatar: "AR", expertise: "Solar PV, Power Systems", phone: "+91 66554 43322" },
//   { id: "U-006", name: "Vikram Singh", email: "vikram.s@brihaspathi.com", role: "technician", avatar: "VS", expertise: "Networking", phone: "+91 55443 32211" },
//   { id: "U-007", name: "Suresh Babu", email: "suresh.b@brihaspathi.com", role: "technician", avatar: "SB", expertise: "Security Systems", phone: "+91 44332 21100" },
//   { id: "U-008", name: "Mohan Das", email: "mohan.d@brihaspathi.com", role: "technician", avatar: "MD", expertise: "Fiber Optics, Networking", phone: "+91 33221 10099" },
//   { id: "U-009", name: "Karthik Rao", email: "karthik.r@brihaspathi.com", role: "technician", avatar: "KR", expertise: "Security Systems, Access Control", phone: "+91 22110 09988" },
//   { id: "U-010", name: "Greenfield Solar Park", email: "contact@greenfield.com", role: "customer", avatar: "GS", phone: "+91 98765 43210" },
//   { id: "U-011", name: "TechHub IT Solutions", email: "support@techhub.in", role: "customer", avatar: "TH", phone: "+91 87654 32109" },
// ];

// interface AuthContextType {
//   user: AppUser | null;
//   login: (email: string) => boolean;
//   logout: () => void;
//   isRole: (...roles: UserRole[]) => boolean;
// }

// const AuthContext = createContext<AuthContextType | null>(null);

// export function AuthProvider({ children }: { children: ReactNode }) {
//   const [user, setUser] = useState<AppUser | null>(null);

//   const login = (email: string) => {
//     const found = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
//     if (found) {
//       setUser(found);
//       return true;
//     }
//     return false;
//   };

//   const logout = () => setUser(null);

//   const isRole = (...roles: UserRole[]) => !!user && roles.includes(user.role);

//   return (
//     <AuthContext.Provider value={{ user, login, logout, isRole }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error("useAuth must be used within AuthProvider");
//   return ctx;
// }

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "supervisor" | "technician" | "customer";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  expertise?: string;
  phone?: string;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole, phone?: string, expertise?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) await fetchProfile(session.user.id);
      else { setUser(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (data && !error) {
      setUser({
        id: data.id,
        name: data.full_name || data.email?.split("@")[0] || "User",
        email: data.email,
        role: data.role as UserRole,
        avatar: data.avatar_url || data.email?.charAt(0).toUpperCase() || "U",
        expertise: data.expertise,
        phone: data.phone,
      });
    }
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signUp(email: string, password: string, fullName: string, role: UserRole, phone?: string, expertise?: string) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role, phone, expertise } },
    });
    if (data.user && !error) {
      await supabase.from("profiles").upsert({
        id: data.user.id, email, full_name: fullName, role, phone, expertise,
        avatar_url: fullName.charAt(0).toUpperCase(),
      });
    }
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  const isRole = (...roles: UserRole[]) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, isRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}