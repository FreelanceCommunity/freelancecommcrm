import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function InviteClientModal({ clientId, orgId }: { clientId: string, orgId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('CLIENT_USER');
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('invite-client', {
        body: { email, client_id: clientId, organization_id: orgId, role }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setOpen(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Invite Client</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Client securely</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Client Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com" />
            <p className="text-xs text-muted-foreground">They will receive a secure token to set their own password.</p>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <select className="flex h-10 w-full rounded-md border px-3" value={role} onChange={e => setRole(e.target.value)}>
              <option value="CLIENT_ADMIN">Client Admin</option>
              <option value="CLIENT_USER">Client User</option>
            </select>
          </div>
          <Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending || !email}>
            {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
