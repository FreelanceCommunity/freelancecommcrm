import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit } from 'lucide-react';

interface ClientEditModalProps {
  client: any;
}

export default function ClientEditModal({ client }: ClientEditModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(client.name || '');
  const [email, setEmail] = useState(client.email || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [website, setWebsite] = useState(client.website || '');
  const [address, setAddress] = useState(client.address || '');
  const [state, setState] = useState(client.state || '');
  const [country, setCountry] = useState(client.country || '');
  const [taxNumber, setTaxNumber] = useState(client.tax_number || '');
  const [status, setStatus] = useState(client.status || 'Active');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('clients')
        .update({
          name,
          email,
          phone,
          website,
          address,
          state,
          country,
          tax_number: taxNumber,
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', client.id] });
      setIsOpen(false);
      toast({ title: 'Success', description: 'Client details updated.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Company Name</label>
            <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Acme Corp" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="contact@acme.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone</label>
            <Input value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="+1 234 567 890" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Website</label>
            <Input value={website} onChange={(e: any) => setWebsite(e.target.value)} placeholder="https://acme.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">State/Province</label>
              <Input value={state} onChange={(e: any) => setState(e.target.value)} placeholder="NY" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Country</label>
              <Input value={country} onChange={(e: any) => setCountry(e.target.value)} placeholder="USA" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Address</label>
            <Input value={address} onChange={(e: any) => setAddress(e.target.value)} placeholder="123 Business St" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tax Number</label>
            <Input value={taxNumber} onChange={(e: any) => setTaxNumber(e.target.value)} placeholder="VAT or EIN" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Lead">Lead</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            className="w-full mt-4" 
            onClick={() => updateClient.mutate()} 
            disabled={updateClient.isPending || !name}
          >
            {updateClient.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
