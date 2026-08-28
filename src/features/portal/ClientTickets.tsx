import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ClientTickets() {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['portal_tickets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
        <Button>New Ticket</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p>Loading tickets...</p>
          ) : tickets?.length === 0 ? (
            <p className="text-muted-foreground">You have no active support tickets.</p>
          ) : (
            <div className="divide-y">
              {tickets?.map(ticket => (
                <div key={ticket.id} className="py-4 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-lg">{ticket.title}</div>
                    <div className="text-sm text-muted-foreground">{ticket.ticket_number} • Priority: {ticket.priority}</div>
                  </div>
                  <div>
                    <span className="px-2 py-1 text-xs bg-muted rounded-full">{ticket.status}</span>
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
