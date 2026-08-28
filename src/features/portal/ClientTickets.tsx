import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LifeBuoy, Plus } from 'lucide-react';

export default function ClientTickets() {
  const { clientId, organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [category, setCategory] = useState('General');

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['portal_tickets', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const createTicket = useMutation({
    mutationFn: async () => {
      if (!clientId || !organizationId || !user) throw new Error('Missing context');

      // Generate ticket number
      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      const ticketNum = `TKT-${String((count || 0) + 1).padStart(6, '0')}`;

      const { error } = await supabase.from('tickets').insert([{
        organization_id: organizationId,
        client_id: clientId,
        created_by: user.id,
        ticket_number: ticketNum,
        title,
        description,
        priority,
        category,
        status: 'Open',
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal_tickets'] });
      setDialogOpen(false);
      setTitle('');
      setDescription('');
      setPriority('Normal');
      setCategory('General');
    },
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-blue-100 text-blue-700';
      case 'In Progress': return 'bg-amber-100 text-amber-700';
      case 'Waiting for Client': return 'bg-purple-100 text-purple-700';
      case 'Resolved': return 'bg-green-100 text-green-700';
      case 'Closed': return 'bg-slate-100 text-slate-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Ticket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createTicket.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={title} onChange={(e: any) => setTitle(e.target.value)} required placeholder="Brief description of the issue" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select value={category} onChange={(e: any) => setCategory(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="General">General</option>
                  <option value="Bug">Bug</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Billing">Billing</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <select value={priority} onChange={(e: any) => setPriority(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea
                  value={description}
                  onChange={(e: any) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  placeholder="Describe your issue in detail..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createTicket.isPending || !title}>
                  {createTicket.isPending ? 'Creating...' : 'Submit Ticket'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="p-10 text-muted-foreground">Loading tickets...</div>
      ) : !tickets || tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LifeBuoy className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No support tickets.</p>
            <p className="text-xs text-muted-foreground mt-1">Click "New Ticket" to create your first support request.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Tickets ({tickets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {tickets.map((ticket: any) => (
                <Link to={`/portal/tickets/${ticket.id}`} key={ticket.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-muted/50 transition-colors px-2 rounded-md -mx-2 block">
                  <div>
                    <div className="font-semibold">{ticket.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {ticket.ticket_number} • {ticket.category} • {new Date(ticket.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      ticket.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                      ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {ticket.priority}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
