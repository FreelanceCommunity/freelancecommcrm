import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminTicketList() {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['admin_tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, client:clients(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
      <Card>
        <CardHeader>
          <CardTitle>Recent Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : tickets?.length === 0 ? (
            <p className="text-muted-foreground">No open tickets.</p>
          ) : (
            <div className="divide-y">
              {tickets?.map(ticket => (
                <div key={ticket.id} className="py-4 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-lg">{ticket.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {ticket.ticket_number} • {ticket.client?.name} • Priority: {ticket.priority}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">{ticket.status}</span>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/app/tickets/${ticket.id}`}>View</Link>
                    </Button>
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
