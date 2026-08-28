import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

type DealFormData = {
  id?: string;
  client_id: string;
  name: string;
  value: number;
  stage_id: string;
  expected_close_date: string;
};

export default function DealsKanban() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DealFormData>({
    client_id: '', name: '', value: 0, stage_id: '', expected_close_date: ''
  });

  const { data: pipeline, isLoading: loadingPipeline } = useQuery({
    queryKey: ['pipelines', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase.from('pipelines').select('id').eq('organization_id', organizationId).limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    enabled: !!organizationId
  });

  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: ['stages', pipeline?.id],
    queryFn: async () => {
      if (!pipeline?.id) return [];
      const { data, error } = await supabase.from('stages').select('*').eq('pipeline_id', pipeline.id).order('order_index');
      if (error) throw error;
      return data;
    },
    enabled: !!pipeline?.id
  });

  const { data: deals, isLoading: loadingDeals } = useQuery({
    queryKey: ['deals', pipeline?.id],
    queryFn: async () => {
      if (!pipeline?.id) return [];
      const { data, error } = await supabase.from('deals').select('*, client:clients(name)').eq('pipeline_id', pipeline.id);
      if (error) throw error;
      return data;
    },
    enabled: !!pipeline?.id
  });

  const { data: clients } = useQuery({
    queryKey: ['clients', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase.from('clients').select('id, name').eq('organization_id', organizationId);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId
  });

  const createDefaultPipeline = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No org');
      const { data: pData, error: pError } = await supabase.from('pipelines').insert([{ name: 'Standard Sales Pipeline', organization_id: organizationId }]).select().single();
      if (pError) throw pError;
      
      const defaultStages = [
        { pipeline_id: pData.id, name: 'Lead In', order_index: 0, probability: 10 },
        { pipeline_id: pData.id, name: 'Contact Made', order_index: 1, probability: 30 },
        { pipeline_id: pData.id, name: 'Meeting Arranged', order_index: 2, probability: 50 },
        { pipeline_id: pData.id, name: 'Needs Defined', order_index: 3, probability: 70 },
        { pipeline_id: pData.id, name: 'Proposal Made', order_index: 4, probability: 90 },
      ];
      const { error: sError } = await supabase.from('stages').insert(defaultStages);
      if (sError) throw sError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipelines'] })
  });

  const upsertDeal = useMutation({
    mutationFn: async (data: DealFormData) => {
      if (!organizationId || !pipeline?.id) throw new Error('Missing org or pipeline');
      const payload = {
        organization_id: organizationId,
        pipeline_id: pipeline.id,
        client_id: data.client_id,
        stage_id: data.stage_id,
        name: data.name,
        value: data.value,
        expected_close_date: data.expected_close_date || null
      };

      if (editingId) {
        const { error } = await supabase.from('deals').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('deals').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const deleteDeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] })
  });

  const updateDealStage = useMutation({
    mutationFn: async ({ dealId, newStageId }: { dealId: string, newStageId: string }) => {
      const { error } = await supabase.from('deals').update({ stage_id: newStageId }).eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] })
  });

  const handleMoveDeal = (dealId: string, stageIndex: number, direction: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!stages) return;
    const newIndex = stageIndex + (direction === 'right' ? 1 : -1);
    if (newIndex >= 0 && newIndex < stages.length) {
      updateDealStage.mutate({ dealId, newStageId: stages[newIndex].id });
    }
  };

  const handleEdit = (deal: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({
      client_id: deal.client_id,
      name: deal.name,
      value: deal.value || 0,
      stage_id: deal.stage_id,
      expected_close_date: deal.expected_close_date ? deal.expected_close_date.split('T')[0] : ''
    });
    setEditingId(deal.id);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ client_id: '', name: '', value: 0, stage_id: stages?.[0]?.id || '', expected_close_date: '' });
    setEditingId(null);
  };

  if (loadingPipeline || loadingStages || loadingDeals) return <div>Loading pipeline...</div>;

  if (!pipeline || !stages || stages.length === 0) {
    return (
      <div className="text-center p-10 border rounded bg-card">
        <h3 className="font-semibold mb-2">No Pipeline configured</h3>
        <p className="text-muted-foreground mb-4">You need to set up stages before managing deals.</p>
        <Button onClick={() => createDefaultPipeline.mutate()} disabled={createDefaultPipeline.isPending}>
          {createDefaultPipeline.isPending ? 'Creating...' : 'Create Default Pipeline'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sales Pipeline</h1>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Deal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Deal' : 'Add Deal'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); upsertDeal.mutate(formData); }} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Deal Name</label>
                <Input value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} required />
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Value ($)</label>
                  <Input type="number" value={formData.value} onChange={(e: any) => setFormData({...formData, value: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expected Close Date</label>
                  <Input type="date" value={formData.expected_close_date} onChange={(e: any) => setFormData({...formData, expected_close_date: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Stage</label>
                <Select value={formData.stage_id} onValueChange={(val: string) => setFormData({...formData, stage_id: val})} required>
                  <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                  <SelectContent>
                    {stages?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={upsertDeal.isPending}>{upsertDeal.isPending ? 'Saving...' : 'Save Deal'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      </div>

      <div className="flex gap-6 overflow-x-auto pb-4 h-[calc(100vh-200px)] items-start">
        {stages.map((stage: any, index: number) => {
          const stageDeals = deals?.filter(d => d.stage_id === stage.id) || [];
          return (
            <div key={stage.id} className="w-80 shrink-0 bg-muted/50 rounded-lg p-4 flex flex-col max-h-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">{stage.name}</h3>
                <span className="bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs">
                  {stageDeals.length}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3">
                {stageDeals.map(deal => (
                  <Card key={deal.id} className="cursor-pointer hover:border-primary transition-colors group relative" onClick={(e) => handleEdit(deal, e)}>
                    <CardContent className="p-4">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete deal?')) deleteDeal.mutate(deal.id);
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="font-medium pr-6">{deal.name}</div>
                      <div className="text-sm text-muted-foreground mb-3">{deal.client?.name}</div>
                      <div className="text-sm font-semibold">{deal.currency || 'USD'} {deal.value?.toLocaleString()}</div>
                      
                      <div className="flex justify-between mt-3 pt-3 border-t" onClick={e => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-xs"
                          disabled={index === 0}
                          onClick={(e) => handleMoveDeal(deal.id, index, 'left', e)}
                        >
                          &larr; Move
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-xs"
                          disabled={index === stages.length - 1}
                          onClick={(e) => handleMoveDeal(deal.id, index, 'right', e)}
                        >
                          Move &rarr;
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
