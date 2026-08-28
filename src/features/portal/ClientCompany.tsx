import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Globe, MapPin, Phone, Mail } from 'lucide-react';

export default function ClientCompany() {
  const { clientId } = useAuth();

  const { data: client, isLoading } = useQuery({
    queryKey: ['portal_company', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('clients')
        .select('*, contacts(*)')
        .eq('id', clientId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading company details...</div>;
  if (!client) return <div className="p-10 text-muted-foreground">No company information found.</div>;

  const primaryContact = client.contacts?.find((c: any) => c.is_primary) || client.contacts?.[0];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Company</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Company Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Company Name</p>
              <p className="font-semibold text-lg">{client.name}</p>
            </div>
            {client.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.phone}</span>
              </div>
            )}
            {client.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{client.website}</a>
              </div>
            )}
            {(client.country || client.state) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{[client.state, client.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
                {client.status}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Primary Contact</CardTitle>
          </CardHeader>
          <CardContent>
            {primaryContact ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{primaryContact.first_name} {primaryContact.last_name}</p>
                </div>
                {primaryContact.email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-sm">{primaryContact.email}</p>
                  </div>
                )}
                {primaryContact.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="text-sm">{primaryContact.phone}</p>
                  </div>
                )}
                {primaryContact.position && (
                  <div>
                    <p className="text-sm text-muted-foreground">Position</p>
                    <p className="text-sm">{primaryContact.position}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No contact information on file.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
