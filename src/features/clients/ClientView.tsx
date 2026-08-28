import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Edit, Phone, Mail, MapPin } from 'lucide-react';
import InviteClientModal from './InviteClientModal';

export default function ClientView() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'deals' | 'team'>('overview');

  const { data: client, isLoading, error } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*, activities(*), deals(*), organization_members(id, role, profiles(first_name, last_name, email))')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  if (isLoading) return <div className="p-10 text-center">Loading client details...</div>;
  if (error || !client) return <div className="p-10 text-center text-destructive">Error loading client</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" asChild>
            <Link to="/app/clients">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
            {client.status}
          </span>
        </div>
        <div className="flex space-x-2">
          <InviteClientModal clientId={client.id} orgId={client.organization_id} />
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <div className="flex space-x-2 border-b pb-2">
        <Button variant={activeTab === 'overview' ? 'default' : 'ghost'} onClick={() => setActiveTab('overview')}>Overview</Button>
        <Button variant={activeTab === 'team' ? 'default' : 'ghost'} onClick={() => setActiveTab('team')}>Team ({client.organization_members?.length || 0})</Button>
        <Button variant={activeTab === 'activities' ? 'default' : 'ghost'} onClick={() => setActiveTab('activities')}>Activities ({client.activities?.length || 0})</Button>
        <Button variant={activeTab === 'deals' ? 'default' : 'ghost'} onClick={() => setActiveTab('deals')}>Deals ({client.deals?.length || 0})</Button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center text-muted-foreground">
                <Mail className="w-4 h-4 mr-2" />
                {client.email || '—'}
              </div>
              <div className="flex items-center text-muted-foreground">
                <Phone className="w-4 h-4 mr-2" />
                {client.phone || '—'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start text-muted-foreground">
                <MapPin className="w-4 h-4 mr-2 mt-0.5" />
                <div>
                  <div>{client.address || '—'}</div>
                  <div>{client.state} {client.country}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'activities' && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {client.activities?.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent activities.</p>
            ) : (
              <div className="space-y-4">
                {client.activities?.map((activity: any) => (
                  <div key={activity.id} className="flex gap-4 p-4 border rounded-lg bg-muted/20">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{activity.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{activity.description}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(activity.activity_date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'team' && (
        <Card>
          <CardHeader>
            <CardTitle>Client Users</CardTitle>
          </CardHeader>
          <CardContent>
            {client.organization_members?.length === 0 ? (
              <p className="text-muted-foreground text-sm">No users invited yet. Click "Invite Client" to add users.</p>
            ) : (
              <div className="divide-y">
                {client.organization_members?.map((member: any) => (
                  <div key={member.id} className="flex justify-between py-3 items-center">
                    <div>
                      <div className="font-semibold">{member.profiles?.first_name} {member.profiles?.last_name}</div>
                      <div className="text-sm text-muted-foreground">{member.profiles?.email}</div>
                    </div>
                    <div className="font-medium text-sm px-2 py-1 bg-muted rounded">
                      {member.role}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'deals' && (
        <Card>
          <CardHeader>
            <CardTitle>Associated Deals</CardTitle>
          </CardHeader>
          <CardContent>
            {client.deals?.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active deals.</p>
            ) : (
              <div className="space-y-4">
                {client.deals?.map((deal: any) => (
                  <div key={deal.id} className="flex justify-between p-4 border rounded-lg bg-muted/20">
                    <div>
                      <div className="font-semibold">{deal.name}</div>
                      <div className="text-sm text-muted-foreground">Status: {deal.status}</div>
                    </div>
                    <div className="font-bold">
                      {deal.currency} {deal.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
