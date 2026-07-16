import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";

export type AppRole = "admin" | "moderator" | "provider" | "customer" | "employer";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  address: string | null;
  bio: string | null;
  profile_completed: boolean;
  deleted_at?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  needsProfileCompletion: boolean;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    role?: AppRole,
    extras?: { phone?: string; address?: string },
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; roles?: AppRole[] }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const applyPendingSignupRole = async (currentRoles: AppRole[], completed: boolean) => {
    // Only relevant right after social signup: profile not completed yet.
    if (completed) {
      try { localStorage.removeItem("pending_signup_role"); } catch { /* ignore */ }
      return null;
    }
    let pending: string | null = null;
    try { pending = localStorage.getItem("pending_signup_role"); } catch { /* ignore */ }
    if (!pending) return null;
    if (!(["customer", "provider", "employer"] as const).includes(pending as "customer" | "provider" | "employer")) {
      try { localStorage.removeItem("pending_signup_role"); } catch { /* ignore */ }
      return null;
    }
    // Never touch admins or accounts that already have more than the single default role.
    if (currentRoles.includes("admin") || currentRoles.length > 1) {
      try { localStorage.removeItem("pending_signup_role"); } catch { /* ignore */ }
      return null;
    }
    // No-op if the default role trigger already gave us the same role.
    if (currentRoles.length === 1 && currentRoles[0] === pending) {
      try { localStorage.removeItem("pending_signup_role"); } catch { /* ignore */ }
      return pending as AppRole;
    }
    // Need the default role trigger to have inserted a row before we can update it.
    if (currentRoles.length !== 1) {
      return null;
    }
    const { error } = await supabase.rpc("set_initial_role", { _role: pending as "customer" | "provider" | "employer" });
    if (error) {
      // Trigger may still be catching up; leave the key so a later refresh can retry.
      return null;
    }
    try { localStorage.removeItem("pending_signup_role"); } catch { /* ignore */ }
    return pending as AppRole;
  };

  const fetchProfileAndRoles = async (userId: string) => {
    // The handle_new_user trigger can lag right after an OAuth sign-up, leaving
    // the profile row briefly missing. Retry a few times so the UI never gets
    // stuck without a profile (which would suppress the completion wizard).
    let profileData: Profile | null = null;
    let rolesData: AppRole[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.rpc("get_user_roles", { _user_id: userId }),
      ]);
      profileData = (profileRes.data as Profile | null) ?? null;
      rolesData = (rolesRes.data as AppRole[]) || [];
      if (profileData) break;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }

    let finalRoles = rolesData;
    if (profileData) {
      const prof = profileData;
      // Apply role selected on the signup screen before an OAuth redirect
      const applied = await applyPendingSignupRole(finalRoles, prof.profile_completed);
      if (applied) finalRoles = [applied];
      // One-time sync: copy phone/address from auth metadata into profile
      try {
        const { data: userResp } = await supabase.auth.getUser();
        const meta = (userResp.user?.user_metadata ?? {}) as Record<string, unknown>;
        const patch: { phone?: string; address?: string } = {};
        if (!prof.phone && typeof meta.phone === "string" && meta.phone) patch.phone = meta.phone;
        if (!prof.address && typeof meta.address === "string" && meta.address) patch.address = meta.address;
        if (Object.keys(patch).length > 0) {
          const { data: updated } = await supabase
            .from("profiles")
            .update(patch)
            .eq("user_id", userId)
            .select("*")
            .maybeSingle();
          if (updated) {
            setProfile(updated as Profile);
            setRoles(finalRoles);
            return updated as Profile;
          }
        }
      } catch {
        /* non-fatal */
      }
      setProfile(prof);
    } else {
      setProfile(null);
    }
    setRoles(finalRoles);
    return profileData;
  };


  const enforceNotDeleted = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("profiles")
      .select("deleted_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.deleted_at) {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setRoles([]);
      toast({
        title: "Account deleted",
        description: "This account was deleted and can no longer sign in.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  useEffect(() => {
    let initialLoad = true;

    // Remember-me: if the user unchecked "Remember me" on login, wipe the
    // Supabase auth token from localStorage when the tab/browser closes so
    // the session does not survive a full close.
    const handleUnload = () => {
      if (sessionStorage.getItem("auth:session-only") === "1") {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
          .forEach((k) => localStorage.removeItem(k));
      }
    };
    window.addEventListener("pagehide", handleUnload);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const prof = await fetchProfileAndRoles(session.user.id);
            if (prof?.deleted_at) {
              await enforceNotDeleted(session.user.id);
            }
            if (initialLoad) {
              initialLoad = false;
              setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
          initialLoad = false;
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const prof = await fetchProfileAndRoles(session.user.id);
        if (prof?.deleted_at) {
          await enforceNotDeleted(session.user.id);
        }
      }
      if (initialLoad) {
        initialLoad = false;
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pagehide", handleUnload);
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    role: AppRole = "customer",
    extras: { phone?: string; address?: string } = {},
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/verify-email`,
        data: {
          display_name: displayName,
          role,
          ...(extras.phone ? { phone: extras.phone } : {}),
          ...(extras.address ? { address: extras.address } : {}),
        },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error as Error | null };

    if (data.user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("deleted_at")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (prof?.deleted_at) {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        setRoles([]);
        return { error: new Error("This account was deleted and can no longer sign in.") };
      }

      const { data: userRoles } = await supabase.rpc("get_user_roles", { _user_id: data.user.id });
      const fetchedRoles = (userRoles as AppRole[]) || [];
      setRoles(fetchedRoles);
      // Best-effort login history (non-blocking)
      supabase.rpc("log_login_event", {
        _user_agent: typeof navigator !=="undefined" ? navigator.userAgent : null,
        _provider:"password",
      }).then(() => {}, () => {});
      return { error: null, roles: fetchedRoles };
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const refreshProfile = async () => {
    if (user) await fetchProfileAndRoles(user.id);
  };

  const needsProfileCompletion = !loading && !!user && !!profile && !profile.profile_completed;

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, loading, needsProfileCompletion, signUp, signIn, signOut, hasRole, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
