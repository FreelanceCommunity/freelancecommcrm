import { useState } from 'react';
import { Calendar, Video, Clock, VideoIcon, Plus, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import JitsiMeetingWrapper from '@/components/JitsiMeetingWrapper';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ClientMeetings() {
  const { clientId, organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('Upcoming');

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
        status: 'Scheduled',
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

  const cancelMeeting = useMutation({
    mutationFn: async (meetingId: string) => {
      if (!confirm('Are you sure you want to cancel this meeting?')) return;
      const { error } = await supabase
        .from('meetings')
        .update({ status: 'Cancelled' })
        .eq('id', meetingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Meeting Cancelled', description: 'Your meeting has been marked as cancelled.' });
      queryClient.invalidateQueries({ queryKey: ['portal_meetings'] });
    }
  });

  const filteredMeetings = meetings?.filter((m) => {
    if (activeTab === 'Upcoming') {
      return m.status === 'Scheduled' || m.status === 'In Progress';
    }
    if (activeTab === 'Past') {
      return m.status === 'Completed' || m.status === 'Cancelled';
    }
    return true;
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading meetings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Join scheduled video sessions with your account manager and development team.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Schedule Meeting</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule a Meeting</DialogTitle>
                <DialogDescription>
                  Choose a date and time for your consultation.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMeeting.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={title} onChange={(e: any) => setTitle(e.target.value)} placeholder="e.g. Project Sync" required />
                </div>
                <div className="space-y-2">
                  <Label>Agenda / Topics</Label>
                  <Input value={description} onChange={(e: any) => setDescription(e.target.value)} placeholder="What would you like to discuss?" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time *</Label>
                    <Input type="datetime-local" value={startTime} onChange={(e: any) => setStartTime(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time *</Label>
                    <Input type="datetime-local" value={endTime} onChange={(e: any) => setEndTime(e.target.value)} required />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMeeting.isPending || !title || !startTime || !endTime}>
                    {createMeeting.isPending ? 'Scheduling...' : 'Confirm Meeting'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-2">
        {['Upcoming', 'Past', 'All'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {!filteredMeetings || filteredMeetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No meetings found in this view.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMeetings.map((meeting: any) => {
            const isCompleted = meeting.status === 'Completed';
            const isCancelled = meeting.status === 'Cancelled';
            const isScheduled = meeting.status === 'Scheduled' || meeting.status === 'In Progress';

            return (
              <Card key={meeting.id} className="flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-semibold">{meeting.title}</CardTitle>
                      <span
                        className={`text-xs font-medium inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-700'
                            : isCancelled
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                        {meeting.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        {new Date(meeting.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                      {meeting.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 bg-muted/30 p-2 rounded">
                          {meeting.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </div>

                <div className="p-4 pt-0 border-t mt-3 space-y-2">
                  <div className="pt-3 flex gap-2">
                    {isScheduled && (
                      <Button
                        variant="default"
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-xs h-9"
                        onClick={() => setActiveRoom(meeting.id)}
                      >
                        <VideoIcon className="mr-1.5 h-4 w-4" /> Join Room
                      </Button>
                    )}
                    {isScheduled && (
                      <Button
                        variant="outline"
                        className="text-xs h-9 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => cancelMeeting.mutate(meeting.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                  {meeting.meeting_url && (
                    <Button variant="ghost" size="sm" className="w-full text-xs h-7" asChild>
                      <a href={meeting.meeting_url} target="_blank" rel="noopener noreferrer">
                        <Video className="mr-1.5 h-3.5 w-3.5" /> External Meeting Link
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
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
