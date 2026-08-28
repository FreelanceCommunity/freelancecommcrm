import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProjectsList() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*, clients(name)');
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div>Loading projects...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
      <Card>
        <CardHeader>
          <CardTitle>Active Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projects?.length === 0 ? <p className="text-muted-foreground">No projects found.</p> : (
            <div className="divide-y">
              {projects?.map(project => (
                <div key={project.id} className="py-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{project.name}</h3>
                    <p className="text-sm text-muted-foreground">{project.clients?.name}</p>
                  </div>
                  <span className="px-2 py-1 text-xs bg-muted rounded-full">{project.status}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
