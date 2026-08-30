import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LifeBuoy, Clock, ChevronRight, Download } from 'lucide-react';
import { exportToCSV } from '@/lib/exportUtils';

const STATUS_TABS = ['All', 'Open', 'In Progress', 'Waiting for Client', 'Resolved', 'Closed'];

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Waiting for Client': 'bg-orange-100 text-orange-700',
  Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-slate-100 text-slate-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700 border-red-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Normal: 'bg-sky-100 text-sky-700 border-sky-200',
  Low: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function AdminTicketList() {
  const [activeTab, setActiveTab] = useState('All');
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['admin_tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, client:clients(name)')
        .order('created_at', { ascending: false }); // latest first
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('tickets').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_tickets'] }),
  });

  const filtered = activeTab === 'All' ? tickets : tickets?.filter(t => t.status === activeTab);

  const handleExport = () => {
    if (filtered) {
      exportToCSV(filtered, 'support_tickets.csv');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LifeBuoy className="h-7 w-7 text-primary" /> Support Tickets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage client support requests</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={!filtered || filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 flex-wrap border-b pb-2">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            {tab}
            <span className="ml-1.5 text-xs opacity-70">
              {tab === 'All' ? tickets?.length || 0 : tickets?.filter(t => t.status === tab).length || 0}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading tickets...</div>
      ) : !filtered || filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <LifeBuoy className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground">No tickets in this category.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered?.map(ticket => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{ticket.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] || 'bg-muted text-muted-foreground'}`}>
                        {ticket.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[ticket.priority] || 'bg-muted text-muted-foreground'}`}>
                        {ticket.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{ticket.ticket_number}</span>
                      {ticket.client?.name && <span>· {ticket.client.name}</span>}
                      <span>· {ticket.category}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={ticket.status}
                      onClick={e => e.stopPropagation()}
                      onChange={e => updateStatus.mutate({ id: ticket.id, status: e.target.value })}
                      className="text-xs rounded border p-1.5 bg-background cursor-pointer"
                    >
                      {['Open', 'In Progress', 'Waiting for Client', 'Resolved', 'Closed'].map(s => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/app/tickets/${ticket.id}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
