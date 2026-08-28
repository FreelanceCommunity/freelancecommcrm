import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LifeBuoy, Plus, Image as ImageIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ClientTickets() {
  const { clientId, organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [appLocation, setAppLocation] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [category, setCategory] = useState('General');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      if (files.length + selected.length > 10) {
        toast({ title: 'Limit exceeded', description: 'You can upload up to 10 images max.', variant: 'destructive' });
        return;
      }
      setFiles(prev => [...prev, ...selected]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const createTicket = useMutation({
    mutationFn: async () => {
      if (!clientId || !organizationId || !user) throw new Error('Missing context');

      // Generate ticket number
      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      const ticketNum = `TKT-${String((count || 0) + 1).padStart(6, '0')}`;

      // 1. Insert the ticket first to get its ID
      const { data: newTicket, error: insertError } = await supabase.from('tickets').insert([{
        organization_id: organizationId,
        client_id: clientId,
        created_by: user.id,
        ticket_number: ticketNum,
        title,
        description,
        app_location: appLocation,
        priority,
        category,
        status: 'Open',
      }]).select().single();

      if (insertError) throw insertError;

      // 2. Upload any attachments
      const uploadedUrls: string[] = [];
      if (files.length > 0 && newTicket) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${organizationId}/tickets/${newTicket.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('ticket_attachments')
            .upload(fileName, file);
            
          if (!uploadError) {
            const { data } = supabase.storage.from('ticket_attachments').getPublicUrl(fileName);
            uploadedUrls.push(data.publicUrl);
          }
        }

        // 3. Update ticket with attachments array
        if (uploadedUrls.length > 0) {
          await supabase.from('tickets').update({ attachments: uploadedUrls }).eq('id', newTicket.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal_tickets'] });
      setDialogOpen(false);
      setTitle('');
      setDescription('');
      setAppLocation('');
      setPriority('Normal');
      setCategory('General');
      setFiles([]);
      toast({ title: 'Ticket Created', description: 'Your support ticket has been submitted successfully.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
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
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createTicket.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Subject <span className="text-destructive">*</span></Label>
                <Input value={title} onChange={(e: any) => setTitle(e.target.value)} required placeholder="Brief description of the issue" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select value={category} onChange={(e: any) => setCategory(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="General">General</option>
                    <option value="Bug">Bug</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Billing">Billing</option>
                    <option value="Feature Request">Feature Request</option>
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
              </div>

              <div className="space-y-2">
                <Label>App Location / Page URL</Label>
                <Input 
                  value={appLocation} 
                  onChange={(e: any) => setAppLocation(e.target.value)} 
                  placeholder="e.g. Home > Settings > My Profile" 
                />
              </div>

              <div className="space-y-2">
                <Label>Description <span className="text-destructive">*</span></Label>
                <textarea
                  value={description}
                  onChange={(e: any) => setDescription(e.target.value)}
                  required
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                  placeholder="Describe your issue in detail..."
                />
              </div>

              <div className="space-y-2">
                <Label>Attachments (Max 10)</Label>
                <div className="p-4 border border-dashed rounded-lg bg-muted/30">
                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {files.map((file, idx) => (
                        <div key={idx} className="relative group">
                          {file.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(file)} alt="preview" className="h-16 w-16 object-cover rounded border" />
                          ) : (
                            <div className="h-16 w-16 bg-background rounded border flex items-center justify-center text-[10px] break-all p-1 text-center">
                              {file.name}
                            </div>
                          )}
                          <button 
                            type="button" 
                            onClick={() => removeFile(idx)}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*,video/*"
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={files.length >= 10}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Select Images ({files.length}/10)
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createTicket.isPending || !title || !description}>
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
