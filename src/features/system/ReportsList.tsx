import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Users, FileText, Bug, DollarSign, Clock, AlertCircle, Download } from 'lucide-react';

function StatCard({ title, value, icon: Icon, color, sub }: { title: string; value: string | number; icon: any; color: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-28 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium w-6 text-right">{value}</span>
    </div>
  );
}

export default function ReportsComponent() {
  const { organizationId } = useAuth();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const cutoff = (() => {
    if (dateRange === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - parseInt(dateRange));
    return d.toISOString();
  })();

  // Fetch all data in parallel
  const { data: clients } = useQuery({
    queryKey: ['report_clients', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name, created_at, status').eq('organization_id', organizationId!);
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: invoices } = useQuery({
    queryKey: ['report_invoices', organizationId, dateRange],
    queryFn: async () => {
      let query = supabase.from('invoices').select('id, total_amount, status, created_at, due_date').eq('organization_id', organizationId!);
      if (cutoff) query = query.gte('created_at', cutoff);
      const { data } = await query;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: tickets } = useQuery({
    queryKey: ['report_tickets', organizationId, dateRange],
    queryFn: async () => {
      let query = supabase.from('tickets').select('id, status, priority, category, created_at').eq('organization_id', organizationId!);
      if (cutoff) query = query.gte('created_at', cutoff);
      const { data } = await query;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: projects } = useQuery({
    queryKey: ['report_projects', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, status, budget, created_at').eq('organization_id', organizationId!);
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: bugs } = useQuery({
    queryKey: ['report_bugs', organizationId, dateRange],
    queryFn: async () => {
      let query = supabase.from('bug_reports').select('id, status, severity, created_at').eq('organization_id', organizationId!);
      if (cutoff) query = query.gte('created_at', cutoff);
      const { data } = await query;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: meetings } = useQuery({
    queryKey: ['report_meetings', organizationId, dateRange],
    queryFn: async () => {
      let query = supabase.from('meetings').select('id, status, start_time').eq('organization_id', organizationId!);
      if (cutoff) query = query.gte('start_time', cutoff);
      const { data } = await query;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Computed stats
  const totalRevenue = invoices?.filter(i => i.status === 'Paid').reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0;
  const pendingRevenue = invoices?.filter(i => ['Unpaid', 'Overdue'].includes(i.status)).reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0;
  const openTickets = tickets?.filter(t => !['Closed', 'Resolved'].includes(t.status)).length || 0;
  const activeProjects = projects?.filter(p => p.status === 'Active').length || 0;
  const activeBugs = bugs?.filter(b => !['Resolved', 'Closed', 'Rejected'].includes(b.status)).length || 0;

  // Ticket by status breakdown
  const ticketStatuses = ['Open', 'In Progress', 'Waiting for Client', 'Resolved', 'Closed'];
  const ticketByStatus = ticketStatuses.map(s => ({
    label: s,
    value: tickets?.filter(t => t.status === s).length || 0,
  }));
  const maxTickets = Math.max(...ticketByStatus.map(t => t.value), 1);

  // Projects by status
  const projectStatuses = ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'];
  const projectByStatus = projectStatuses.map(s => ({
    label: s,
    value: projects?.filter(p => p.status === s).length || 0,
  }));
  const maxProjects = Math.max(...projectByStatus.map(p => p.value), 1);

  // Bug by severity
  const bugSeverities = ['Critical', 'High', 'Medium', 'Low'];
  const bugBySeverity = bugSeverities.map(s => ({
    label: s,
    value: bugs?.filter(b => b.severity === s).length || 0,
  }));
  const maxBugs = Math.max(...bugBySeverity.map(b => b.value), 1);

  const exportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Revenue (Paid)', `$${totalRevenue.toFixed(2)}`],
      ['Pending Revenue', `$${pendingRevenue.toFixed(2)}`],
      ['Total Clients', clients?.length || 0],
      ['Total Invoices', invoices?.length || 0],
      ['Open Tickets', openTickets],
      ['Total Projects', projects?.length || 0],
      ['Active Projects', activeProjects],
      ['Total Bug Reports', bugs?.length || 0],
      ['Active Bugs', activeBugs],
      ['Total Meetings', meetings?.length || 0],
    ];
    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" /> Analytics & Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time overview of your business performance</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range */}
          <div className="flex gap-1 border rounded-lg p-1">
            {(['7d', '30d', '90d', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${dateRange === range ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {range === 'all' ? 'All Time' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <StatCard title="Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} color="bg-green-100 text-green-700" sub="Paid invoices" />
        <StatCard title="Pending" value={`$${pendingRevenue.toLocaleString()}`} icon={AlertCircle} color="bg-amber-100 text-amber-700" sub="Unpaid/Overdue" />
        <StatCard title="Clients" value={clients?.length || 0} icon={Users} color="bg-blue-100 text-blue-700" sub="Total clients" />
        <StatCard title="Invoices" value={invoices?.length || 0} icon={FileText} color="bg-purple-100 text-purple-700" sub={`${invoices?.filter(i => i.status === 'Paid').length || 0} paid`} />
        <StatCard title="Projects" value={projects?.length || 0} icon={TrendingUp} color="bg-indigo-100 text-indigo-700" sub={`${activeProjects} active`} />
        <StatCard title="Meetings" value={meetings?.length || 0} icon={Clock} color="bg-cyan-100 text-cyan-700" sub="Scheduled" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Tickets by Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Tickets by Status
              <span className="ml-auto text-xs font-normal text-muted-foreground">{tickets?.length || 0} total</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ticketByStatus.map(item => (
              <BarRow key={item.label} label={item.label} value={item.value} max={maxTickets}
                color={item.label === 'Open' ? 'bg-blue-400' : item.label === 'In Progress' ? 'bg-amber-400' : item.label === 'Resolved' ? 'bg-green-400' : item.label === 'Closed' ? 'bg-slate-400' : 'bg-orange-400'}
              />
            ))}
          </CardContent>
        </Card>

        {/* Projects by Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" /> Projects by Status
              <span className="ml-auto text-xs font-normal text-muted-foreground">{projects?.length || 0} total</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projectByStatus.map(item => (
              <BarRow key={item.label} label={item.label} value={item.value} max={maxProjects}
                color={item.label === 'Active' ? 'bg-green-400' : item.label === 'Planning' ? 'bg-blue-400' : item.label === 'Completed' ? 'bg-emerald-400' : item.label === 'On Hold' ? 'bg-amber-400' : 'bg-red-400'}
              />
            ))}
          </CardContent>
        </Card>

        {/* Bugs by Severity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bug className="h-4 w-4 text-red-500" /> Bugs by Severity
              <span className="ml-auto text-xs font-normal text-muted-foreground">{bugs?.length || 0} total</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bugBySeverity.map(item => (
              <BarRow key={item.label} label={item.label} value={item.value} max={maxBugs}
                color={item.label === 'Critical' ? 'bg-red-500' : item.label === 'High' ? 'bg-orange-400' : item.label === 'Medium' ? 'bg-amber-400' : 'bg-slate-400'}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Invoice Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {['Paid', 'Unpaid', 'Overdue', 'Draft'].map(status => {
              const count = invoices?.filter(i => i.status === status).length || 0;
              const amount = invoices?.filter(i => i.status === status).reduce((s, i) => s + (i.total_amount || 0), 0) || 0;
              const colors: Record<string, string> = {
                Paid: 'bg-green-50 border-green-200 text-green-700',
                Unpaid: 'bg-amber-50 border-amber-200 text-amber-700',
                Overdue: 'bg-red-50 border-red-200 text-red-700',
                Draft: 'bg-slate-50 border-slate-200 text-slate-600',
              };
              return (
                <div key={status} className={`p-3 rounded-lg border ${colors[status]}`}>
                  <div className="text-xs font-medium opacity-70">{status}</div>
                  <div className="text-lg font-bold mt-1">{count}</div>
                  <div className="text-xs">${amount.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
