import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, CheckCircle } from 'lucide-react';

export default function ClientServices() {
  const { clientId } = useAuth();

  const { data: services, isLoading } = useQuery({
    queryKey: ['portal_services', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('client_id', clientId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading services...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Services</h1>

      {!services || services.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No services assigned to your account yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((svc: any) => (
            <Card key={svc.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">{svc.name}</CardTitle>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  svc.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                }`}>
                  {svc.status === 'Active' && <CheckCircle className="h-3 w-3" />}
                  {svc.status}
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {svc.description || 'Service provided as part of your subscription.'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
