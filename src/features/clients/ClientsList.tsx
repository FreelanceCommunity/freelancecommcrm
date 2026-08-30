import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { Search, Plus, Download } from 'lucide-react';
import { exportToCSV } from '@/lib/exportUtils';

export default function ClientsList() {
  const [search, setSearch] = useState('');

  const { data: clients, isLoading, error } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const filteredClients = clients?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    if (filteredClients) {
      exportToCSV(filteredClients, 'clients.csv');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!filteredClients || filteredClients.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button asChild>
            <Link to="/app/clients/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search clients..."
            className="w-full pl-8"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10">Loading clients...</div>
      ) : error ? (
        <div className="text-center text-destructive py-10">Error loading clients</div>
      ) : filteredClients?.length === 0 ? (
        <div className="text-center py-10 border rounded-lg bg-card">
          <h3 className="mt-2 text-sm font-semibold">No clients yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new client.</p>
          <div className="mt-6">
            <Button asChild>
              <Link to="/app/clients/new">
                <Plus className="mr-2 h-4 w-4" />
                New Client
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border bg-card">
          <div className="w-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Phone</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredClients?.map((client) => (
                  <tr key={client.id} className="transition-colors hover:bg-muted/50">
                    <td className="p-4 font-medium">{client.name}</td>
                    <td className="p-4 text-muted-foreground">{client.email || '-'}</td>
                    <td className="p-4 text-muted-foreground">{client.phone || '-'}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                        {client.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/app/clients/${client.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
