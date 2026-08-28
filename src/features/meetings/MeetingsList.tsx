import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Video, Clock, User, Plus } from 'lucide-react';

export default function MeetingsList() {
  const { organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['admin_meetings', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('meetings')
        .select('*, client:clients(name)')
        .eq('organization_id', organizationId)
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients_lookup', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').eq('organization_id', organizationId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const createMeeting = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('meetings').insert([{
        organization_id: organizationId,
        title,
        client_id: clientId || null,
        organizer_id: user?.id,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        meeting_url: meetingUrl || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_meetings'] });
      setOpen(false);
      setTitle('');
      setStartTime('');
      setEndTime('');
      setMeetingUrl('');
    }
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading meetings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Schedule Meeting</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Meeting</DialogTitle>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createMeeting.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Client (Optional)</Label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full rounded-md border p-2">
                  <option value="">No Client (Internal)</option>
                  {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Meeting Link (Jitsi, Zoom, Meet)</Label>
                <Input value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMeeting.isPending || !title || !startTime || !endTime}>
                  {createMeeting.isPending ? 'Scheduling...' : 'Schedule'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!meetings || meetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No meetings scheduled.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {meetings.map((meeting: any) => (
            <Card key={meeting.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{meeting.title}</CardTitle>
                <div className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1 rounded bg-muted px-2 py-1 w-fit mt-2">
                  {meeting.status}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {new Date(meeting.start_time).toLocaleString()}
                  </div>
                  {meeting.client && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {meeting.client.name}
                    </div>
                  )}
                </div>
                {meeting.meeting_url && (
                  <Button variant="secondary" className="w-full" asChild>
                    <a href={meeting.meeting_url} target="_blank" rel="noopener noreferrer">
                      <Video className="mr-2 h-4 w-4" /> Join Meeting
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
