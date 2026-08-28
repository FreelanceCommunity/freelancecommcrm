import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Calendar, Video, Clock, VideoIcon } from 'lucide-react';
import JitsiMeetingWrapper from '@/components/JitsiMeetingWrapper';

export default function ClientMeetings() {
  const { clientId } = useAuth();
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

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

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading meetings...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>

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
                    <VideoIcon className="mr-2 h-4 w-4" /> Start Native Call
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
