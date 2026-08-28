
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';

// For simplicity without a full DnD library, we'll use a basic column layout where you can click to move deals.
export default function DealsKanban() {
  const queryClient = useQueryClient();

  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: ['stages'],
    queryFn: async () => {
      // Get org id
      const { data: orgs } = await supabase.rpc('get_user_organizations');
      if (!orgs || orgs.length === 0) return [];
      
      const { data, error } = await supabase
        .from('stages')
        .select('*')
        .order('order_index');
      
      // If no stages exist for the org, we should technically create default ones, but for now just fetch.
      if (error) throw error;
      return data;
    }
  });

  const { data: deals, isLoading: loadingDeals } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, client:clients(name)');
      if (error) throw error;
      return data;
    }
  });

  const updateDealStage = useMutation({
    mutationFn: async ({ dealId, newStageId }: { dealId: string, newStageId: string }) => {
      const { error } = await supabase.from('deals').update({ stage_id: newStageId }).eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] })
  });

  const handleMoveDeal = (dealId: string, stageIndex: number, direction: 'left' | 'right') => {
    if (!stages) return;
    const newIndex = stageIndex + (direction === 'right' ? 1 : -1);
    if (newIndex >= 0 && newIndex < stages.length) {
      updateDealStage.mutate({ dealId, newStageId: stages[newIndex].id });
    }
  };

  if (loadingStages || loadingDeals) return <div>Loading pipeline...</div>;

  if (!stages || stages.length === 0) {
    return (
      <div className="text-center p-10 border rounded bg-card">
        <h3 className="font-semibold mb-2">No Pipeline configured</h3>
        <p className="text-muted-foreground mb-4">You need to set up stages before managing deals.</p>
        <Button>Create Default Pipeline</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sales Pipeline</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Deal
        </Button>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4 h-[calc(100vh-200px)] items-start">
        {stages.map((stage, index) => {
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
                  <Card key={deal.id} className="cursor-pointer hover:border-primary transition-colors">
                    <CardContent className="p-4">
                      <div className="font-medium">{deal.name}</div>
                      <div className="text-sm text-muted-foreground mb-3">{deal.client?.name}</div>
                      <div className="text-sm font-semibold">{deal.currency} {deal.value}</div>
                      
                      {/* Simple move controls since no drag and drop library is installed */}
                      <div className="flex justify-between mt-3 pt-3 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-xs"
                          disabled={index === 0}
                          onClick={() => handleMoveDeal(deal.id, index, 'left')}
                        >
                          &larr; Move
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-xs"
                          disabled={index === stages.length - 1}
                          onClick={() => handleMoveDeal(deal.id, index, 'right')}
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
