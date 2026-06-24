export interface ChatChannelLike {
  id?: string;
  name: string | null;
  is_group: boolean;
  channel_type?: string | null;
}

export interface ChatDisplayContext {
  otherUserId?: string;
  profiles: Record<string, { user_id: string; full_name: string | null; avatar_url?: string | null }>;
}

export function resolveChannelDisplayName(channel: ChatChannelLike, context: ChatDisplayContext) {
  if (channel.is_group) {
    if (channel.name?.trim()) return channel.name.trim();
    if (channel.channel_type === 'general') return 'General';
    return 'Group chat';
  }

  const peerProfile = context.otherUserId ? context.profiles[context.otherUserId] : undefined;
  if (peerProfile?.full_name?.trim()) return peerProfile.full_name.trim();
  return 'Direct message';
}
