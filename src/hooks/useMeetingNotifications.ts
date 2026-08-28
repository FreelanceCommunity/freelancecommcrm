import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Subscribes to realtime meetings inserts/updates.
 * Shows a popup toast notification whenever a meeting is created or updated
 * for the current user's organization (admin) or client (client portal).
 */
export function useMeetingNotifications() {
  const { organizationId, clientId, user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!organizationId || !user) return;

    // Build filter: admins see all org meetings; clients only see their own
    const filter = clientId
      ? `client_id=eq.${clientId}`
      : `organization_id=eq.${organizationId}`;

    const channel = supabase
      .channel(`meeting-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meetings',
          filter,
        },
        (payload) => {
          const meeting = payload.new as any;
          // Don't notify the organizer who just created the meeting
          if (meeting.organizer_id === user.id) return;

          const startTime = meeting.start_time
            ? new Date(meeting.start_time).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';

          toast({
            title: `📅 New Meeting Scheduled`,
            description: `"${meeting.title}" — ${startTime}`,
            duration: 8000,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
          filter,
        },
        (payload) => {
          const meeting = payload.new as any;
          if (meeting.organizer_id === user.id) return;

          toast({
            title: `📅 Meeting Updated`,
            description: `"${meeting.title}" has been updated.`,
            duration: 6000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, clientId, user, toast]);
}
