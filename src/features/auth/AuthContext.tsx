/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'OWNER' | 'ADMIN' | 'STAFF' | 'ACCOUNT_MANAGER' | 'SUPPORT_AGENT' | 'CLIENT_ADMIN' | 'CLIENT_USER';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface UserMembership {
  organization_id: string;
  role: UserRole;
  client_id: string | null;
  organization_name: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  memberships: UserMembership[];
  activeRole: UserRole | null;
  organizationId: string | null;
  clientId: string | null;
  isAdmin: boolean;
  isClient: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const ADMIN_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'STAFF', 'ACCOUNT_MANAGER', 'SUPPORT_AGENT'];
const CLIENT_ROLES: UserRole[] = ['CLIENT_ADMIN', 'CLIENT_USER'];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRoles = useCallback(async (_userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_profile_with_role');
      if (error) {
        console.error('Failed to fetch profile:', error);
        setProfile(null);
        setMemberships([]);
        return;
      }

      if (data) {
        setProfile(data.profile || null);
        setMemberships(data.memberships || []);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
      setMemberships([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfileAndRoles(session.user.id);
      }

      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        await fetchProfileAndRoles(session.user.id);
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setMemberships([]);
      }

      if (loading) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfileAndRoles, loading]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setMemberships([]);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileAndRoles(user.id);
    }
  };

  // Derive role info from memberships
  const activeRole = memberships.length > 0 ? memberships[0].role : null;
  const organizationId = memberships.length > 0 ? memberships[0].organization_id : null;
  const clientId = memberships.find(m => CLIENT_ROLES.includes(m.role))?.client_id ?? null;
  const isAdmin = memberships.some(m => ADMIN_ROLES.includes(m.role));
  const isClient = memberships.some(m => CLIENT_ROLES.includes(m.role));

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading MYSTEL...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      memberships,
      activeRole,
      organizationId,
      clientId,
      isAdmin,
      isClient,
      loading,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
