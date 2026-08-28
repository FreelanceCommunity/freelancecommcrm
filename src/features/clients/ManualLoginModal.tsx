import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ManualLoginModal({ clientId, orgId }: { clientId: string, orgId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CLIENT_USER');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createLoginMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('create-client-login', {
        body: { email, password, role, client_id: clientId, organization_id: orgId }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setIsOpen(false);
      setEmail('');
      setPassword('');
      toast({ title: 'Success', description: 'Client login created manually.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Key className="mr-2 h-4 w-4" />
          Create Login
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Client Login</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4 text-sm">
          <p className="text-muted-foreground">Manually create an account for this client. They will be able to log in immediately with the password you set.</p>
          <div className="space-y-2">
            <label className="font-medium">Email Address</label>
            <Input value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="client@example.com" />
          </div>
          <div className="space-y-2">
            <label className="font-medium">Password</label>
            <Input type="text" value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="Minimum 6 characters" />
          </div>
          <div className="space-y-2">
            <label className="font-medium">Role</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CLIENT_ADMIN">Client Admin</SelectItem>
                <SelectItem value="CLIENT_USER">Client User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            className="w-full" 
            onClick={() => createLoginMutation.mutate()} 
            disabled={createLoginMutation.isPending || !email || password.length < 6}
          >
            {createLoginMutation.isPending ? 'Creating...' : 'Create Account'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
