import { useState } from 'react';
import { Calendar, Video, Clock, VideoIcon, Plus } from 'lucide-react';
import JitsiMeetingWrapper from '@/components/JitsiMeetingWrapper';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ClientMeetings() {
  const { clientId, organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['portal_meetings', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('client_id', clientId)
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const createMeeting = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('meetings').insert([{
        organization_id: organizationId,
        title,
        description: description || null,
        client_id: clientId,
        organizer_id: user?.id,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        meeting_url: null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal_meetings'] });
      setOpen(false);
      setTitle('');
      setDescription('');
      setStartTime('');
      setEndTime('');
      toast({ title: 'Success', description: 'Meeting scheduled successfully.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
              <DialogTitle>Schedule a Meeting</DialogTitle>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createMeeting.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e: any) => setTitle(e.target.value)} placeholder="e.g. Project Sync" required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={description} onChange={(e: any) => setDescription(e.target.value)} placeholder="What is this meeting about?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="datetime-local" value={startTime} onChange={(e: any) => setStartTime(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="datetime-local" value={endTime} onChange={(e: any) => setEndTime(e.target.value)} required />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
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
            <p className="text-muted-foreground">No upcoming meetings scheduled.</p>
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
                </div>
                <div className="space-y-2 mt-4">
                  <Button variant="default" className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => setActiveRoom(meeting.id)}>
                    <VideoIcon className="mr-2 h-4 w-4" /> Join Meeting
                  </Button>
                  {meeting.meeting_url && (
                    <Button variant="secondary" className="w-full" asChild>
                      <a href={meeting.meeting_url} target="_blank" rel="noopener noreferrer">
                        <Video className="mr-2 h-4 w-4" /> External Link
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeRoom && (
        <JitsiMeetingWrapper 
          roomName={activeRoom} 
          onClose={() => setActiveRoom(null)} 
        />
      )}
    </div>
  );
}
