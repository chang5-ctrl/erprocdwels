import { describe, it, expect } from 'vitest';
import { resolveChannelDisplayName } from './chatUtils';

describe('resolveChannelDisplayName', () => {
  it('returns the peer full name when available', () => {
    expect(resolveChannelDisplayName({
      is_group: false,
      name: null,
      channel_type: 'dm',
    }, { otherUserId: 'user-2', profiles: { 'user-2': { user_id: 'user-2', full_name: 'Ada Lovelace' } } })).toBe('Ada Lovelace');
  });

  it('falls back to a generic label when the profile is missing', () => {
    expect(resolveChannelDisplayName({
      is_group: false,
      name: null,
      channel_type: 'dm',
    }, { otherUserId: 'user-2', profiles: {} })).toBe('Direct message');
  });

  it('uses the stored channel name for group chat', () => {
    expect(resolveChannelDisplayName({
      is_group: true,
      name: 'Operations',
      channel_type: 'group',
    }, { otherUserId: undefined, profiles: {} })).toBe('Operations');
  });
});
