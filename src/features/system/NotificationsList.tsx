import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NotificationsComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'Notifications'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('notifications').select('*').limit(20);
        if (error) return [];
        return data || [];
      } catch {
        return [];
      }
    }
  });

  if (isLoading) return <div className="p-10">Loading Notifications...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
      <Card>
        <CardHeader>
          <CardTitle>Notifications Records</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.length === 0 ? (
            <p className="text-muted-foreground">No records found.</p>
          ) : (
            <div className="divide-y">
              {data.map((item: any, i: number) => (
                <div key={item.id || i} className="py-4 flex justify-between">
                  <div>
                    <span className="font-medium">{item.name || item.title || item.first_name || item.action || item.description || 'Record ' + (i+1)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.created_at || item.start_date ? new Date(item.created_at || item.start_date).toLocaleDateString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
