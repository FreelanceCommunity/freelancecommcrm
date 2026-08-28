import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

type ContactFormData = {
  id?: string;
  client_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  is_primary: boolean;
};

const defaultFormData: ContactFormData = {
  client_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  position: '',
  is_primary: false
};

export default function ContactsList() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>(defaultFormData);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('contacts')
        .select('*, clients(name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId
  });

  const { data: clients } = useQuery({
    queryKey: ['clients', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('organization_id', organizationId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (!organizationId) throw new Error('No organization');
      const payload = {
        organization_id: organizationId,
        client_id: data.client_id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        position: data.position,
        is_primary: data.is_primary
      };

      if (editingId) {
        const { error } = await supabase.from('contacts').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('contacts').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    }
  });

  const handleEdit = (contact: any) => {
    setFormData({
      client_id: contact.client_id,
      first_name: contact.first_name,
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      position: contact.position || '',
      is_primary: contact.is_primary || false
    });
    setEditingId(contact.id);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate(formData);
  };

  if (isLoading) return <div>Loading contacts...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}><Plus className="mr-2 h-4 w-4" /> New Contact</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Contact' : 'Create Contact'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <Select value={formData.client_id} onValueChange={(val: string) => setFormData({...formData, client_id: val})} required>
                  <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                  <SelectContent>
                    {clients?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name</label>
                  <Input value={formData.first_name} onChange={(e: any) => setFormData({...formData, first_name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Last Name</label>
                  <Input value={formData.last_name} onChange={(e: any) => setFormData({...formData, last_name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input value={formData.phone} onChange={(e: any) => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Position</label>
                  <Input value={formData.position} onChange={(e: any) => setFormData({...formData, position: e.target.value})} />
                </div>
                <div className="space-y-2 flex items-center gap-2 mt-8">
                  <Checkbox 
                    id="is_primary" 
                    checked={formData.is_primary} 
                    onCheckedChange={(checked: any) => setFormData({...formData, is_primary: !!checked})} 
                  />
                  <label htmlFor="is_primary" className="text-sm font-medium cursor-pointer">Primary Contact</label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={upsertMutation.isPending}>{upsertMutation.isPending ? 'Saving...' : 'Save'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts?.length === 0 ? <p className="text-muted-foreground">No contacts found.</p> : (
            <div className="divide-y">
              {contacts?.map((contact: any) => (
                <div key={contact.id} className="py-4 flex justify-between items-center group">
                  <div>
                    <h3 className="font-medium text-lg flex items-center gap-2">
                      {contact.first_name} {contact.last_name}
                      {contact.is_primary && <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider bg-primary/10 text-primary rounded-full">Primary</span>}
                    </h3>
                    <p className="text-sm font-medium mt-1">Client: {contact.clients?.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {contact.position && <span className="mr-2">{contact.position}</span>}
                      {contact.email && <span className="mr-2">| {contact.email}</span>}
                      {contact.phone && <span>| {contact.phone}</span>}
                    </p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(contact)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => {
                      if (confirm('Are you sure you want to delete this contact?')) {
                        deleteMutation.mutate(contact.id);
                      }
                    }}><Trash2 className="h-4 w-4" /></Button>
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
