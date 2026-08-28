import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bug } from 'lucide-react';

export default function ClientBugs() {
  const { clientId } = useAuth();

  const { data: bugs, isLoading } = useQuery({
    queryKey: ['portal_bugs', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('bug_reports')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading bug reports...</div>;

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Medium': return 'bg-amber-100 text-amber-700';
      case 'Low': return 'bg-slate-100 text-slate-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Bug Reports</h1>

      {!bugs || bugs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bug className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No bug reports.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Bug Reports ({bugs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {bugs.map((bug: any) => (
                <div key={bug.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="font-semibold">{bug.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(bug.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColor(bug.severity)}`}>
                      {bug.severity}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                      {bug.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
