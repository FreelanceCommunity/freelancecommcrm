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

type ProjectFormData = {
  id?: string;
  name: string;
  client_id: string;
  description: string;
  status: string;
};

const defaultFormData: ProjectFormData = {
  name: '',
  client_id: '',
  description: '',
  status: 'Planning'
};

export default function ProjectsList() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>(defaultFormData);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('projects')
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
    mutationFn: async (data: ProjectFormData) => {
      if (!organizationId) throw new Error('No organization');
      const payload = {
        organization_id: organizationId,
        name: data.name,
        client_id: data.client_id,
        description: data.description,
        status: data.status,
      };

      if (editingId) {
        const { error } = await supabase.from('projects').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('projects').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });

  const handleEdit = (project: any) => {
    setFormData({
      name: project.name,
      client_id: project.client_id,
      description: project.description || '',
      status: project.status
    });
    setEditingId(project.id);
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

  if (isLoading) return <div>Loading projects...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}><Plus className="mr-2 h-4 w-4" /> New Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Project' : 'Create Project'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Name</label>
                <Input 
                  value={formData.name} 
                  onChange={(e: any) => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Client</label>
                <Select value={formData.client_id} onValueChange={(val: string) => setFormData({...formData, client_id: val})} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={formData.status} onValueChange={(val: string) => setFormData({...formData, status: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planning">Planning</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea 
                  value={formData.description} 
                  onChange={(e: any) => setFormData({...formData, description: e.target.value})} 
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projects?.length === 0 ? <p className="text-muted-foreground">No projects found.</p> : (
            <div className="divide-y">
              {projects?.map((project: any) => (
                <div key={project.id} className="py-4 flex justify-between items-center group">
                  <div>
                    <h3 className="font-medium text-lg">{project.name}</h3>
                    <p className="text-sm text-muted-foreground">Client: {project.clients?.name}</p>
                    {project.description && <p className="text-sm mt-1">{project.description}</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      project.status === 'Active' ? 'bg-green-100 text-green-700' :
                      project.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                      project.status === 'Planning' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {project.status}
                    </span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(project)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => {
                        if (confirm('Are you sure you want to delete this project?')) {
                          deleteMutation.mutate(project.id);
                        }
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
