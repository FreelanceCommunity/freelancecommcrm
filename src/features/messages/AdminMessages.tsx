import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, User } from 'lucide-react';

function formatDateSeparator(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function AdminMessages() {
  const { organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch clients with their last message time — sorted latest first
  const { data: clients } = useQuery({
    queryKey: ['chat_clients', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data: clientData, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('organization_id', organizationId);
      if (error) throw error;

      // For each client, get last message & unread count
      const enriched = await Promise.all(
        (clientData || []).map(async (c) => {
          const { data: lastMsg } = await supabase
            .from('client_messages')
            .select('message, created_at, sender_id, read_at, deleted_at')
            .eq('client_id', c.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count: unreadCount } = await supabase
            .from('client_messages')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', c.id)
            .neq('sender_id', user?.id || '')
            .is('read_at', null)
            .is('deleted_at', null);

          return {
            ...c,
            lastMessage: lastMsg,
            lastMessageTime: lastMsg?.created_at ? new Date(lastMsg.created_at) : new Date(0),
            unreadCount: unreadCount || 0,
          };
        })
      );

      // Sort by most recent message first
      enriched.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
      return enriched;
    },
    enabled: !!organizationId,
    refetchInterval: 5000, // Poll for sidebar updates
  });

  // Fetch messages for selected client
  const { data: messages, isLoading } = useQuery({
    queryKey: ['chat_messages', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data, error } = await supabase
        .from('client_messages')
        .select('*, sender:profiles(first_name, last_name)')
        .eq('client_id', selectedClientId)
        .order('created_at', { ascending: true }); // oldest first in chat window
      if (error) throw error;

      // Mark unread as read
      const unreadIds = data.filter(m => !m.read_at && m.sender_id !== user?.id).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('client_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
        queryClient.invalidateQueries({ queryKey: ['chat_clients'] });
      }

      return data || [];
    },
    enabled: !!selectedClientId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!selectedClientId) return;
    const subscription = supabase
      .channel(`chat_admin_${selectedClientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'client_messages',
        filter: `client_id=eq.${selectedClientId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat_messages', selectedClientId] });
        queryClient.invalidateQueries({ queryKey: ['chat_clients'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [selectedClientId, queryClient]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (messageText: string) => {
      if (!selectedClientId || !user) return;
      const { error } = await supabase.from('client_messages').insert([{
        organization_id: organizationId,
        client_id: selectedClientId,
        sender_id: user.id,
        message: messageText,
      }]);
      if (error) throw error;
    },
    onSuccess: () => setNewMessage(''),
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.from('client_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_messages', selectedClientId] });
    },
  });

  // Group messages by date for separators
  const groupedMessages = () => {
    if (!messages) return [];
    const groups: { date: string; messages: any[] }[] = [];
    let currentDate = '';
    for (const msg of messages) {
      const msgDate = formatDateSeparator(new Date(msg.created_at));
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }
    return groups;
  };

  const selectedClientName = clients?.find(c => c.id === selectedClientId)?.name;

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-background rounded-lg border overflow-hidden">
      {/* Sidebar — sorted latest first */}
      <div className="w-72 border-r flex flex-col shrink-0">
        <div className="p-4 border-b bg-muted/50">
          <h2 className="font-semibold text-sm">Messages</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Chat with clients</p>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {clients?.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelectedClientId(c.id)}
              className={`w-full flex items-center gap-3 p-3 text-left rounded-lg transition-colors ${
                selectedClientId === c.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selectedClientId === c.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/20 text-foreground'}`}>
                {c.name?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{c.name}</span>
                  {c.unreadCount > 0 && (
                    <span className="ml-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                {c.lastMessage && (
                  <div className={`text-xs truncate mt-0.5 ${selectedClientId === c.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {c.lastMessage.deleted_at ? '🚫 Message deleted' : c.lastMessage.message}
                  </div>
                )}
                {c.lastMessage && (
                  <div className={`text-[10px] mt-0.5 ${selectedClientId === c.id ? 'text-primary-foreground/50' : 'text-muted-foreground/70'}`}>
                    {new Date(c.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-muted/10 min-w-0">
        {!selectedClientId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-2">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <User className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p>Select a client to start chatting</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-card font-semibold shadow-sm z-10 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                {selectedClientName?.[0]?.toUpperCase()}
              </div>
              {selectedClientName}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading && <div className="text-center text-muted-foreground text-sm">Loading messages...</div>}
              {groupedMessages().map(({ date, messages: dayMsgs }) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full border">{date}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-3">
                    {dayMsgs.map((msg: any) => {
                      // Admin (me) = right side (blue), Client = left side (gray)
                      const isMe = msg.sender_id === user?.id;
                      const isDeleted = !!msg.deleted_at;
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                          <div className={`flex items-end gap-2 max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            {!isMe && (
                              <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                                {msg.sender?.first_name?.[0] || 'C'}
                              </div>
                            )}
                            <div className="relative">
                              <div className={`p-3 rounded-2xl text-sm shadow-sm break-words ${
                                isMe
                                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                                  : 'bg-card border rounded-bl-sm'
                              }`}>
                                {isDeleted ? (
                                  <span className="italic opacity-60 flex items-center gap-1">🚫 Message deleted</span>
                                ) : (
                                  msg.message
                                )}
                              </div>
                              {isMe && !isDeleted && (
                                <button
                                  onClick={() => deleteMessage.mutate(msg.id)}
                                  className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full p-0.5 shadow"
                                  title="Delete for everyone"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className={`text-[10px] text-muted-foreground mt-1 flex items-center gap-1 ${isMe ? 'mr-1' : 'ml-9'}`}>
                            {!isMe && `${msg.sender?.first_name || 'Client'} · `}
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isMe && (
                              <span className={`font-bold tracking-tighter ml-1 ${msg.read_at ? 'text-blue-400' : 'text-muted-foreground/50'}`}>✓✓</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={e => { e.preventDefault(); if (newMessage.trim()) sendMessage.mutate(newMessage.trim()); }}
              className="p-4 bg-card border-t flex gap-2"
            >
              <Input
                value={newMessage}
                onChange={(e: any) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1"
                disabled={sendMessage.isPending}
              />
              <Button type="submit" disabled={sendMessage.isPending || !newMessage.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
