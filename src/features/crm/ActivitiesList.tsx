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

type ActivityFormData = {
  id?: string;
  client_id: string;
  deal_id: string | null;
  type: string;
  title: string;
  description: string;
  activity_date: string;
};

const defaultFormData: ActivityFormData = {
  client_id: '',
  deal_id: null,
  type: 'Note',
  title: '',
  description: '',
  activity_date: new Date().toISOString().split('T')[0]
};

export default function ActivitiesList() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ActivityFormData>(defaultFormData);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: activities, isLoading } = useQuery({
    queryKey: ['activities', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('activities')
        .select('*, clients(name), deals(name)')
        .eq('organization_id', organizationId)
        .order('activity_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId
  });

  const { data: clients } = useQuery({
    queryKey: ['clients', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase.from('clients').select('id, name').eq('organization_id', organizationId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: ActivityFormData) => {
      if (!organizationId) throw new Error('No organization');
      const payload = {
        organization_id: organizationId,
        client_id: data.client_id,
        deal_id: data.deal_id || null,
        type: data.type,
        title: data.title,
        description: data.description,
        activity_date: data.activity_date
      };

      if (editingId) {
        const { error } = await supabase.from('activities').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('activities').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    }
  });

  const handleEdit = (activity: any) => {
    setFormData({
      client_id: activity.client_id,
      deal_id: activity.deal_id,
      type: activity.type,
      title: activity.title,
      description: activity.description || '',
      activity_date: activity.activity_date ? activity.activity_date.split('T')[0] : ''
    });
    setEditingId(activity.id);
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

  if (isLoading) return <div>Loading activities...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}><Plus className="mr-2 h-4 w-4" /> Log Activity</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Activity' : 'Log Activity'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input value={formData.title} onChange={(e: any) => setFormData({...formData, title: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={formData.type} onValueChange={(val: string) => setFormData({...formData, type: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Note">Note</SelectItem>
                      <SelectItem value="Call">Call</SelectItem>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="Meeting">Meeting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input type="date" value={formData.activity_date} onChange={(e: any) => setFormData({...formData, activity_date: e.target.value})} required />
                </div>
              </div>
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea value={formData.description} onChange={(e: any) => setFormData({...formData, description: e.target.value})} rows={3} />
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
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {activities?.length === 0 ? <p className="text-muted-foreground">No activities found.</p> : (
            <div className="divide-y">
              {activities?.map((activity: any) => (
                <div key={activity.id} className="py-4 flex justify-between items-center group">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                        activity.type === 'Call' ? 'bg-blue-100 text-blue-700' :
                        activity.type === 'Meeting' ? 'bg-purple-100 text-purple-700' :
                        activity.type === 'Email' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {activity.type}
                      </span>
                      <h3 className="font-medium text-lg">{activity.title}</h3>
                    </div>
                    <p className="text-sm font-medium mt-1">Client: {activity.clients?.name}</p>
                    {activity.description && <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-sm text-muted-foreground">
                      {activity.activity_date ? new Date(activity.activity_date).toLocaleDateString() : ''}
                    </span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(activity)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="destructive" size="sm" onClick={() => {
                        if (confirm('Are you sure you want to delete this activity?')) {
                          deleteMutation.mutate(activity.id);
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
