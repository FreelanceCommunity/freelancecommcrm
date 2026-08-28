import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Subscribes to realtime notifications inserts.
 * Shows a popup toast notification whenever a new record is added to public.notifications
 * for the current user.
 */
export function useAppNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`app-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as any;
          
          let icon = '🔔';
          if (notification.type.includes('meeting')) icon = '📅';
          if (notification.type.includes('ticket')) icon = '🎫';
          if (notification.type.includes('message')) icon = '💬';
          if (notification.type.includes('invoice') || notification.type.includes('payment')) icon = '💰';

          toast({
            title: `${icon} ${notification.title}`,
            description: notification.message,
            duration: 8000,
          });

          // Invalidate notifications query so the badge updates
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast, queryClient]);
}
