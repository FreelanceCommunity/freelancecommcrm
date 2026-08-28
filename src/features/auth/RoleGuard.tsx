import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

export type Role = 'OWNER' | 'ADMIN' | 'STAFF' | 'ACCOUNT_MANAGER' | 'SUPPORT_AGENT' | 'CLIENT_ADMIN' | 'CLIENT_USER';

export function useUserRoles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['userRoles', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('organization_members')
        .select('role, organization_id')
        .eq('user_id', user.id);
        
      if (error) throw error;
      return data as { role: Role; organization_id: string }[];
    },
    enabled: !!user,
  });
}

export function RoleGuard({ children, allowedRoles }: { children: ReactNode; allowedRoles: Role[] }) {
  const { data: roles, isLoading } = useUserRoles();

  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading permissions...</div>;

  const hasAccess = roles?.some(r => allowedRoles.includes(r.role));

  if (!hasAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
