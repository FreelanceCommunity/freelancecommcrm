import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClientProjects() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['client_projects'],
    queryFn: async () => {
      // RLS filters to only their allowed projects
      const { data, error } = await supabase.from('projects').select('*');
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
      <Card>
        <CardHeader>
          <CardTitle>Active Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projects?.length === 0 ? <p className="text-muted-foreground">No projects assigned.</p> : (
            <div className="divide-y">
              {projects?.map((p: any) => (
                <div key={p.id} className="py-4">
                  <h3 className="font-medium">{p.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">Status: {p.status}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
