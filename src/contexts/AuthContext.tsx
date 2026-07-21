// import { createContext, useContext, useState, useEffect, ReactNode } from "react";
// import { User, Session } from "@supabase/supabase-js";
// import { supabase } from "@/lib/supabase";

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

// interface AuthContextType {
//   user: AppUser | null;
//   session: Session | null;
//   loading: boolean;
//   signIn: (email: string, password: string) => Promise<{ error: any }>;
//   signUp: (email: string, password: string, fullName: string, role: UserRole, phone?: string, expertise?: string) => Promise<{ error: any }>;
//   signOut: () => Promise<void>;
//   isRole: (...roles: UserRole[]) => boolean;
// }

// const AuthContext = createContext<AuthContextType | null>(null);

// export function AuthProvider({ children }: { children: ReactNode }) {
//   const [user, setUser] = useState<AppUser | null>(null);
//   const [session, setSession] = useState<Session | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     supabase.auth.getSession().then(({ data: { session } }) => {
//       setSession(session);
//       if (session?.user) fetchProfile(session.user.id);
//       else setLoading(false);
//     });

//     const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
//       setSession(session);
//       if (session?.user) await fetchProfile(session.user.id);
//       else { setUser(null); setLoading(false); }
//     });

//     return () => subscription.unsubscribe();
//   }, []);

//   async function fetchProfile(userId: string) {
//     const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
//     if (data && !error) {
//       setUser({
//         id: data.id,
//         name: data.full_name || data.email?.split("@")[0] || "User",
//         email: data.email,
//         role: data.role as UserRole,
//         avatar: data.avatar_url || data.email?.charAt(0).toUpperCase() || "U",
//         expertise: data.expertise,
//         phone: data.phone,
//       });
//     }
//     setLoading(false);
//   }

//   async function signIn(email: string, password: string) {
//     const { error } = await supabase.auth.signInWithPassword({ email, password });
//     return { error };
//   }

//   async function signUp(email: string, password: string, fullName: string, role: UserRole, phone?: string, expertise?: string) {
//     const { data, error } = await supabase.auth.signUp({
//       email, password,
//       options: { data: { full_name: fullName, role, phone, expertise } },
//     });
//     if (data.user && !error) {
//       await supabase.from("profiles").upsert({
//         id: data.user.id, email, full_name: fullName, role, phone, expertise,
//         avatar_url: fullName.charAt(0).toUpperCase(),
//       });
//     }
//     return { error };
//   }

//   async function signOut() {
//     await supabase.auth.signOut();
//     setUser(null);
//   }

//   const isRole = (...roles: UserRole[]) => !!user && roles.includes(user.role);

//   return (
//     <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, isRole }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error("useAuth must be used within AuthProvider");
//   return ctx;
// }

import { createContext, useContext, useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "supervisor" | "technician" | "customer";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  expertise?: string;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
      if (session?.user) {
        setLoading(true);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 🔥 Fetch user profile with full_name from Supabase
  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, phone, expertise, avatar_url")
      .eq("id", userId)
      .single();

    if (data && !error) {
      setUser({
        id: data.id,
        // 🔥 Use full_name from database
        name: data.full_name || "User",
        email: data.email,
        role: data.role as UserRole,
        phone: data.phone,
        expertise: data.expertise,
        avatar: data.avatar_url,
      });
    } else {
      // Fallback: Use auth user data
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser({
          id: authUser.id,
          name: authUser.user_metadata?.full_name || "User",
          email: authUser.email || "",
          role: (authUser.user_metadata?.role as UserRole) || "customer",
          phone: authUser.phone || "",
        });
      }
    }
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (!error && data?.user) {
      if (data.user.email && data.user.email !== email) {
        await supabase.auth.signOut();
        return { error: new Error("Invalid email or password (emails are case-sensitive).") };
      }
    }
    
    return { error };
  }

  async function signUp(email: string, password: string, fullName: string, role: UserRole, phone?: string, expertise?: string) {
    // If the active user is an admin, call the edge function to avoid replacing the admin's session
    if (user?.role === "admin") {
      try {
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: { email, password, fullName, role, phone, expertise },
        });
        if (error) {
          throw new Error(error.message || "Failed to create user via Edge Function");
        }
        return { error: null };
      } catch (err: any) {
        console.error("Admin user creation edge function error:", err);
        return { error: err };
      }
    }

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