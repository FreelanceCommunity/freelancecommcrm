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
import { Textarea } from '@/components/ui/textarea';

type LeadFormData = {
  id?: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: string;
  source: string;
  estimated_value: number;
  notes: string;
};

const defaultFormData: LeadFormData = {
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  status: 'New',
  source: 'Website',
  estimated_value: 0,
  notes: ''
};

export default function LeadsList() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<LeadFormData>(defaultFormData);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      if (!organizationId) throw new Error('No organization');
      const payload = {
        organization_id: organizationId,
        company_name: data.company_name,
        contact_name: data.contact_name,
        email: data.email,
        phone: data.phone,
        status: data.status,
        source: data.source,
        estimated_value: data.estimated_value,
        notes: data.notes
      };

      if (editingId) {
        const { error } = await supabase.from('leads').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('leads').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });

  const handleEdit = (lead: any) => {
    setFormData({
      company_name: lead.company_name,
      contact_name: lead.contact_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      status: lead.status,
      source: lead.source,
      estimated_value: lead.estimated_value || 0,
      notes: lead.notes || ''
    });
    setEditingId(lead.id);
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

  if (isLoading) return <div>Loading leads...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}><Plus className="mr-2 h-4 w-4" /> New Lead</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Lead' : 'Create Lead'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Company Name</label>
                  <Input value={formData.company_name} onChange={(e: any) => setFormData({...formData, company_name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contact Name</label>
                  <Input value={formData.contact_name} onChange={(e: any) => setFormData({...formData, contact_name: e.target.value})} />
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
                  <label className="text-sm font-medium">Status</label>
                  <Select value={formData.status} onValueChange={(val: string) => setFormData({...formData, status: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Contacted">Contacted</SelectItem>
                      <SelectItem value="Qualified">Qualified</SelectItem>
                      <SelectItem value="Proposal">Proposal</SelectItem>
                      <SelectItem value="Lost">Lost</SelectItem>
                      <SelectItem value="Converted">Converted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Source</label>
                  <Select value={formData.source} onValueChange={(val: string) => setFormData({...formData, source: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Cold Call">Cold Call</SelectItem>
                      <SelectItem value="Advertisement">Advertisement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">Estimated Value ($)</label>
                  <Input type="number" value={formData.estimated_value} onChange={(e: any) => setFormData({...formData, estimated_value: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea value={formData.notes} onChange={(e: any) => setFormData({...formData, notes: e.target.value})} rows={3} />
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
          <CardTitle>All Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {leads?.length === 0 ? <p className="text-muted-foreground">No leads found.</p> : (
            <div className="divide-y">
              {leads?.map((lead: any) => (
                <div key={lead.id} className="py-4 flex justify-between items-center group">
                  <div>
                    <h3 className="font-medium text-lg">{lead.company_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {lead.contact_name && <span className="mr-2">Contact: {lead.contact_name}</span>}
                      {lead.email && <span className="mr-2">| {lead.email}</span>}
                      {lead.phone && <span>| {lead.phone}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        lead.status === 'Converted' ? 'bg-green-100 text-green-700' :
                        lead.status === 'Lost' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {lead.status}
                      </span>
                      {lead.estimated_value > 0 && <div className="text-sm font-semibold mt-1">${lead.estimated_value.toLocaleString()}</div>}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(lead)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="destructive" size="sm" onClick={() => {
                        if (confirm('Are you sure you want to delete this lead?')) {
                          deleteMutation.mutate(lead.id);
                        }
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
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
