import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

export default function ClientFeatures() {
  const { clientId } = useAuth();

  const { data: features, isLoading } = useQuery({
    queryKey: ['portal_features', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('feature_requests')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) {
        // Table might not exist yet if migration hasn't run
        console.warn('feature_requests query failed:', error.message);
        return [];
      }
      return data || [];
    },
    enabled: !!clientId,
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading feature requests...</div>;

  const statusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'In Progress': return 'bg-blue-100 text-blue-700';
      case 'Under Review': return 'bg-amber-100 text-amber-700';
      case 'Submitted': return 'bg-slate-100 text-slate-600';
      case 'Rejected': return 'bg-red-100 text-red-700';
      case 'Completed': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Feature Requests</h1>

      {!features || features.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lightbulb className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No feature requests.</p>
            <p className="text-xs text-muted-foreground mt-1">Submit feature requests via support tickets.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Feature Requests ({features.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {features.map((feature: any) => (
                <div key={feature.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="font-semibold">{feature.title}</div>
                    <div className="text-sm text-muted-foreground line-clamp-1">
                      {feature.description || 'No description'}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${statusColor(feature.status)}`}>
                    {feature.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
