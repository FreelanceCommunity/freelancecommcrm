import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { 
  Calendar, Video, Clock, User, Plus, VideoIcon, CheckCircle2, 
  Trash2, Edit, Search, Check, AlertCircle, ArrowUpRight, Loader2
} from 'lucide-react';
import JitsiMeetingWrapper from '@/components/JitsiMeetingWrapper';
import { useToast } from '@/hooks/use-toast';

export default function MeetingsList() {
  const { organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [openSchedule, setOpenSchedule] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<any>(null);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['admin_meetings', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('meetings')
        .select('*, client:clients(name, email), project:projects(name)')
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

  const { data: projects } = useQuery({
    queryKey: ['projects_lookup', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, name, client_id').eq('organization_id', organizationId);
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
        description: description || null,
        client_id: clientId || null,
        project_id: projectId || null,
        organizer_id: user?.id,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        status: 'Scheduled',
        meeting_url: null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_meetings'] });
      setOpenSchedule(false);
      resetForm();
      toast({ title: 'Meeting Scheduled', description: 'Meeting has been placed on the calendar.' });
    },
    onError: (err: any) => {
      toast({ title: 'Scheduling Error', description: err.message, variant: 'destructive' });
    }
  });

  // Mark as Done / Status Update
  const updateMeetingStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('meetings').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.status === 'Completed' ? 'Meeting Marked as Done!' : `Status Updated to ${variables.status}`,
        description: `Meeting status updated.`
      });
      queryClient.invalidateQueries({ queryKey: ['admin_meetings'] });
    },
    onError: (err: any) => {
      toast({ title: 'Update Failed', description: err.message, variant: 'destructive' });
    }
  });

  // Delete Meeting
  const deleteMeeting = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Meeting Deleted', description: 'Meeting was successfully removed.' });
      queryClient.invalidateQueries({ queryKey: ['admin_meetings'] });
      setDeletingMeetingId(null);
    },
    onError: (err: any) => {
      toast({ title: 'Delete Failed', description: err.message, variant: 'destructive' });
    }
  });

  // Edit Meeting
  const updateMeetingDetails = useMutation({
    mutationFn: async () => {
      if (!editingMeeting) return;
      const { error } = await supabase
        .from('meetings')
        .update({
          title,
          description: description || null,
          client_id: clientId || null,
          project_id: projectId || null,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
        })
        .eq('id', editingMeeting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Meeting Updated', description: 'Meeting details saved.' });
      queryClient.invalidateQueries({ queryKey: ['admin_meetings'] });
      setEditingMeeting(null);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: 'Update Failed', description: err.message, variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setClientId('');
    setProjectId('');
    setStartTime('');
    setEndTime('');
  };

  const openEditModal = (meeting: any) => {
    setEditingMeeting(meeting);
    setTitle(meeting.title || '');
    setDescription(meeting.description || '');
    setClientId(meeting.client_id || '');
    setProjectId(meeting.project_id || '');
    setStartTime(meeting.start_time ? new Date(meeting.start_time).toISOString().slice(0, 16) : '');
    setEndTime(meeting.end_time ? new Date(meeting.end_time).toISOString().slice(0, 16) : '');
  };

  // Filter meetings based on active tab and search
  const filteredMeetings = meetings?.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.description?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'Upcoming') {
      return m.status === 'Scheduled' || m.status === 'In Progress';
    }
    if (activeTab === 'Completed') {
      return m.status === 'Completed';
    }
    if (activeTab === 'Cancelled') {
      return m.status === 'Cancelled';
    }
    return true; // 'All'
  });

  const upcomingCount = meetings?.filter((m) => m.status === 'Scheduled' || m.status === 'In Progress').length || 0;
  const completedCount = meetings?.filter((m) => m.status === 'Completed').length || 0;
  const cancelledCount = meetings?.filter((m) => m.status === 'Cancelled').length || 0;

  if (isLoading) {
    return (
      <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
        <p>Loading scheduled meetings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meetings & Video Syncs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage client consultations, launch video calls, mark meetings as completed, and track logs.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { resetForm(); setOpenSchedule(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search meetings or clients..."
            className="w-full pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {[
            { id: 'Upcoming', label: 'Upcoming / Active', count: upcomingCount },
            { id: 'Completed', label: 'Done / Completed', count: completedCount },
            { id: 'Cancelled', label: 'Cancelled', count: cancelledCount },
            { id: 'All', label: 'All Meetings', count: meetings?.length || 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted bg-background border'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] opacity-75 font-semibold">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Meetings Grid */}
      {!filteredMeetings || filteredMeetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold text-base">No meetings found in this view</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {activeTab === 'Upcoming'
                ? 'No upcoming meetings are scheduled right now.'
                : activeTab === 'Completed'
                ? 'No meetings have been marked as done yet.'
                : 'No meetings match your current filters.'}
            </p>
            {activeTab === 'Upcoming' && (
              <Button size="sm" className="mt-4" onClick={() => { resetForm(); setOpenSchedule(true); }}>
                <Plus className="mr-1.5 h-4 w-4" /> Schedule One Now
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMeetings.map((meeting: any) => {
            const isCompleted = meeting.status === 'Completed';
            const isCancelled = meeting.status === 'Cancelled';
            const isScheduled = meeting.status === 'Scheduled' || meeting.status === 'In Progress';

            return (
              <Card key={meeting.id} className="flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                {isCompleted && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                )}
                {isCancelled && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
                )}

                <div>
                  <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0 gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {meeting.title}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : isCancelled
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {meeting.status}
                        </span>

                        {meeting.project && (
                          <span className="text-[11px] font-medium bg-muted px-2 py-0.5 rounded text-muted-foreground">
                            {meeting.project.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEditModal(meeting)}
                        title="Edit meeting"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingMeetingId(meeting.id)}
                        title="Delete meeting"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-2 text-sm">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-muted/30 p-2 rounded">
                      <Calendar className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <div>{new Date(meeting.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div className="text-muted-foreground text-[11px]">
                          {new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(meeting.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    {meeting.client && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium text-foreground">{meeting.client.name}</span>
                        {meeting.client.email && <span className="truncate">({meeting.client.email})</span>}
                      </div>
                    )}

                    {meeting.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic bg-muted/10 p-2 rounded border border-muted/20">
                        "{meeting.description}"
                      </p>
                    )}
                  </CardContent>
                </div>

                {/* Card Actions: Video Link, Mark Done, Delete */}
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

                    {/* Done / Complete Option */}
                    {meeting.status !== 'Completed' ? (
                      <Button
                        variant="outline"
                        className="flex-1 text-xs h-9 border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                        onClick={() => updateMeetingStatus.mutate({ id: meeting.id, status: 'Completed' })}
                        title="Mark this meeting as completed"
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Done
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="flex-1 text-xs h-9 text-muted-foreground"
                        onClick={() => updateMeetingStatus.mutate({ id: meeting.id, status: 'Scheduled' })}
                        title="Re-open meeting to scheduled"
                      >
                        Re-open
                      </Button>
                    )}
                  </div>

                  {meeting.meeting_url && (
                    <Button variant="ghost" size="sm" className="w-full text-xs h-7 text-muted-foreground" asChild>
                      <a href={meeting.meeting_url} target="_blank" rel="noopener noreferrer">
                        External Conference Link <ArrowUpRight className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Schedule Meeting Modal */}
      <Dialog open={openSchedule} onOpenChange={setOpenSchedule}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Schedule Client Meeting</DialogTitle>
            <DialogDescription>
              Set up a video consultation room with native Jitsi conference.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMeeting.mutate();
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Monthly Progress Review"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Client (Optional)</Label>
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setProjectId('');
                  }}
                  className="w-full rounded-md border p-2 bg-background text-xs"
                >
                  <option value="">No Client (Internal)</option>
                  {clients?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Project (Optional)</Label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-md border p-2 bg-background text-xs"
                >
                  <option value="">No Project</option>
                  {projects
                    ?.filter((p: any) => !clientId || p.client_id === clientId)
                    .map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Time *</Label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Time *</Label>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Agenda / Notes</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background p-2 text-xs"
                placeholder="Key topics to discuss in this session..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenSchedule(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMeeting.isPending || !title || !startTime || !endTime}>
                {createMeeting.isPending ? 'Scheduling...' : 'Confirm Schedule'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Meeting Modal */}
      <Dialog open={!!editingMeeting} onOpenChange={(open) => !open && setEditingMeeting(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Meeting Details</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMeetingDetails.mutate();
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Client</Label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-md border p-2 bg-background text-xs"
                >
                  <option value="">No Client</option>
                  {clients?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Project</Label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-md border p-2 bg-background text-xs"
                >
                  <option value="">No Project</option>
                  {projects?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Time</Label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Time</Label>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingMeeting(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMeetingDetails.isPending}>
                {updateMeetingDetails.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deletingMeetingId} onOpenChange={(open) => !open && setDeletingMeetingId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" /> Delete Meeting?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete this meeting from the calendar and remove its conference room link. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeletingMeetingId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMeeting.isPending}
              onClick={() => deletingMeetingId && deleteMeeting.mutate(deletingMeetingId)}
            >
              {deleteMeeting.isPending ? 'Deleting...' : 'Delete Meeting'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Jitsi Meeting Popup */}
      {activeRoom && (
        <JitsiMeetingWrapper
          roomName={activeRoom}
          onClose={() => setActiveRoom(null)}
        />
      )}
    </div>
  );
}
