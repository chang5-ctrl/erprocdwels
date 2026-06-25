import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageSquare, Send, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { resolveChannelDisplayName } from './chatUtils';

interface Channel {
  id: string;
  name: string | null;
  is_group: boolean;
  display_name: string;
  other_user_id?: string;
  last_message?: string;
  last_message_at?: string;
  unread: number;
  last_read_at: string;
}

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface Profile { user_id: string; full_name: string | null; avatar_url?: string | null }

const COLORS = ['bg-primary', 'bg-accent', 'bg-emerald-500', 'bg-blue-500', 'bg-rose-500', 'bg-purple-500', 'bg-amber-500'];
const colorFor = (id: string) => COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const initialsOf = (name?: string | null) => (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

const timeShort = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso); const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const timeLong = (iso?: string) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
};

export default function TeamChat() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => channels.find(c => c.id === activeId) || null, [channels, activeId]);

  const loadProfiles = async () => {
    const { data } = await supabase.from('user_profiles').select('user_id, full_name, avatar_url');
    const map: Record<string, Profile> = {};
    (data || []).forEach(p => { map[p.user_id] = p as Profile; });
    setProfiles(map);
    return map;
  };

  const loadChannels = async (profileMap: Record<string, Profile>) => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from('chat_channel_members')
      .select('channel_id, last_read_at, chat_channels(id, name, is_group, channel_type)')
      .eq('user_id', user.id);

    const rows: Channel[] = [];
    const seenDm = new Set<string>();
    for (const m of memberships || []) {
      const ch: any = (m as any).chat_channels;
      if (!ch) continue;
      let display = 'Conversation';
      let other: string | undefined;
      if (!ch.is_group) {
        const { data: others } = await supabase
          .from('chat_channel_members').select('user_id').eq('channel_id', ch.id).neq('user_id', user.id).limit(1);
        other = others?.[0]?.user_id;
        if (!other) continue;
        if (seenDm.has(other)) continue;
        seenDm.add(other);
      }
      display = resolveChannelDisplayName(ch, { otherUserId: other, profiles: profileMap });
      const { data: lastMsgArr } = await supabase
        .from('chat_messages')
        .select('content, created_at').eq('channel_id', ch.id).order('created_at', { ascending: false }).limit(1);
      const last = lastMsgArr?.[0];
      const { count: unread } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', ch.id)
        .gt('created_at', (m as any).last_read_at)
        .neq('sender_id', user.id);
      rows.push({
        id: ch.id, name: ch.name, is_group: ch.is_group,
        display_name: display, other_user_id: other,
        last_message: last?.content, last_message_at: last?.created_at,
        unread: unread || 0, last_read_at: (m as any).last_read_at,
      });
    }
    rows.sort((a, b) => {
      // Group channels (General, project) on top
      if (a.is_group !== b.is_group) return a.is_group ? -1 : 1;
      return (b.last_message_at || '').localeCompare(a.last_message_at || '');
    });
    setChannels(rows);
    if (!activeId && rows.length) setActiveId(rows[0].id);
  };

  const refreshChatState = async (focusChannelId?: string) => {
    const map = await loadProfiles();
    await loadChannels(map);
    const targetId = focusChannelId || activeIdRef.current;
    if (targetId) {
      await loadMessages(targetId);
    }
  };

  const loadMessages = async (channelId: string) => {
    const { data } = await supabase.from('chat_messages')
      .select('*').eq('channel_id', channelId).order('created_at');
    setMessages((data as any) || []);
    if (user) {
      await supabase.from('chat_channel_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channelId).eq('user_id', user.id);
    }
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  };

  useEffect(() => {
    if (!user) return;
    void refreshChatState();
    const ch = supabase.channel(`chat-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const msg = payload.new as Message;
        if (msg.channel_id === activeIdRef.current) {
          setMessages(prev => {
            if (prev.some(p => p.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
        }
        setChannels(prev => prev.map(c => c.id === msg.channel_id ? {
          ...c,
          last_message: msg.content,
          last_message_at: msg.created_at,
          unread: msg.channel_id === activeIdRef.current || msg.sender_id === user.id ? c.unread : c.unread + 1,
        } : c));
        if (msg.channel_id === activeIdRef.current) {
          await supabase.from('chat_channel_members').update({ last_read_at: new Date().toISOString() })
            .eq('channel_id', msg.channel_id).eq('user_id', user.id);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_channel_members' }, () => {
        void refreshChatState(activeIdRef.current || undefined);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_channel_members' }, () => {
        void refreshChatState(activeIdRef.current || undefined);
      })
      .subscribe();

    const poll = window.setInterval(() => {
      if (activeIdRef.current) {
        void loadMessages(activeIdRef.current);
      }
    }, 3000);

    return () => {
      window.clearInterval(poll);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const activeIdRef = useRef<string | null>(null);
  useEffect(() => { activeIdRef.current = activeId; if (activeId) loadMessages(activeId); }, [activeId]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = input.trim();
    if (!content || !activeId || !user || sending) return;

    setSending(true);
    setInput('');

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      channel_id: activeId,
      sender_id: user.id,
      content,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 30);

    const { data, error } = await supabase.from('chat_messages')
      .insert({ channel_id: activeId, sender_id: user.id, content })
      .select('id, channel_id, sender_id, content, created_at')
      .single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(content);
      toast.error(error.message || 'Unable to send message');
      setSending(false);
      return;
    }

    setMessages(prev => {
      const without = prev.filter(m => m.id !== tempId);
      if (without.some(p => p.id === (data as any).id)) return without;
      return [...without, data as any];
    });

    await refreshChatState(activeId);
    setSending(false);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left column */}
      <aside className="flex w-[280px] shrink-0 flex-col border-r bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Team Chat</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setNewDmOpen(true)} title="New direct message">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {channels.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
          ) : channels.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`flex w-full items-start gap-3 border-b p-3 text-left hover:bg-muted/40 ${activeId === c.id ? 'bg-muted/60' : ''}`}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className={`${c.is_group ? 'bg-primary/20 text-primary' : `${colorFor(c.other_user_id || c.id)} text-white`} text-xs font-semibold`}>
                  {c.is_group ? <Users className="h-4 w-4" /> : initialsOf(c.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{c.display_name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeShort(c.last_message_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">{c.last_message || 'No messages yet'}</p>
                  {c.unread > 0 && (
                    <Badge className="h-5 min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-[10px]">{c.unread}</Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
      </aside>

      {/* Right column */}
      <section className="flex flex-1 flex-col bg-background">
        {!active ? (
          <div className="m-auto text-center text-muted-foreground">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>Select a conversation to start chatting.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b p-4">
              <Avatar className="h-9 w-9">
                <AvatarFallback className={`${active.is_group ? 'bg-primary/20 text-primary' : `${colorFor(active.other_user_id || active.id)} text-white`} text-xs font-semibold`}>
                  {active.is_group ? <Users className="h-4 w-4" /> : initialsOf(active.display_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{active.display_name}</h3>
                <p className="text-xs text-muted-foreground">{active.is_group ? 'Group channel' : 'Direct message'}</p>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
              <div className="mx-auto flex max-w-3xl flex-col gap-3">
                {messages.map(m => {
                  const mine = m.sender_id === user?.id;
                  const sender = profiles[m.sender_id];
                  return (
                    <div key={m.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className={`${colorFor(m.sender_id)} text-white text-[10px] font-semibold`}>
                          {initialsOf(sender?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${mine
                        ? 'bg-gradient-to-br from-primary to-purple-600 text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'}`}>
                        {!mine && (
                          <p className="mb-0.5 text-[10px] font-medium opacity-70">{sender?.full_name || 'User'}</p>
                        )}
                        <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                        <p className={`mt-1 text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {timeLong(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <p className="py-12 text-center text-sm text-muted-foreground">No messages yet — say hi!</p>
                )}
              </div>
            </div>

            <footer className="border-t bg-card p-3">
              <form className="mx-auto flex max-w-3xl gap-2" onSubmit={send}>
                <textarea
                  value={input}
                  placeholder="Type a message…"
                  rows={1}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(e as any); } }}
                  disabled={!activeId || sending}
                  className="min-h-[44px] max-h-32 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button type="submit" disabled={!input.trim() || !activeId || sending}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </footer>
          </>
        )}
      </section>

      <NewDmDialog
        open={newDmOpen}
        onOpenChange={setNewDmOpen}
        profiles={Object.values(profiles).filter(p => p.user_id !== user?.id)}
        onStarted={async (channelId) => {
          setNewDmOpen(false);
          const map = await loadProfiles();
          await loadChannels(map);
          setActiveId(channelId);
        }}
      />
    </div>
  );
}

function NewDmDialog({ open, onOpenChange, profiles, onStarted }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  profiles: Profile[]; onStarted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const start = async (uid: string) => {
    setBusy(true);
    const { data, error } = await supabase.rpc('start_direct_message', { _other: uid });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    onStarted(data as string);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Start a direct message</DialogTitle></DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {profiles.length === 0 && <p className="text-sm text-muted-foreground">No other staff members found.</p>}
          {profiles.map(p => (
            <button key={p.user_id} disabled={busy}
              onClick={() => start(p.user_id)}
              className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={`${colorFor(p.user_id)} text-white text-xs font-semibold`}>
                  {initialsOf(p.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{p.full_name || 'Unnamed user'}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
