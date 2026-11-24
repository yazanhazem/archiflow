import { describe, expect, it, vi } from 'vitest';
import { acknowledgeWrite, createSyncQueue } from './studioSync';

describe('studio write and sync', () => {
  it('keeps a committed invitation result when sync fails and retries only the read', async () => {
    const failure = new Error('Connection interrupted');
    const read = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(['invite']);
    const publish = vi.fn();
    const report = vi.fn();
    const queue = createSyncQueue(read, publish, report, vi.fn());
    const invite = vi.fn(() => ({ data: 'returned-invitation-token', error: null }));

    expect(acknowledgeWrite(invite(), () => queue.request(true))).toBe('returned-invitation-token');
    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith(failure));
    expect(publish).not.toHaveBeenCalled();
    await queue.request();
    expect(publish).toHaveBeenCalledWith(['invite']);
    expect(report).toHaveBeenLastCalledWith(null);
    expect(invite).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('propagates a rejected write without applying it or scheduling a refresh', () => {
    const refresh = vi.fn();
    const apply = vi.fn();
    expect(() => acknowledgeWrite({ data: null, error: new Error('Write rejected') }, refresh, apply)).toThrow('Write rejected');
    expect(refresh).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it('coalesces invalidations and discards the superseded response', async () => {
    let release!: (value: string) => void;
    const oldRead = new Promise<string>(resolve => { release = resolve; });
    const read = vi.fn().mockReturnValueOnce(oldRead).mockResolvedValueOnce('current');
    const publish = vi.fn();
    const queue = createSyncQueue(read, publish, vi.fn(), vi.fn());
    const first = queue.request();
    await Promise.resolve();
    expect(queue.request(true)).toBe(first);
    expect(queue.request(true)).toBe(first);
    release('old');
    await first;
    expect(read).toHaveBeenCalledTimes(2);
    expect(publish.mock.calls).toEqual([['current']]);
  });

  it('discards results when the account scope closes', async () => {
    const publish = vi.fn();
    const queue = createSyncQueue(async () => 'previous account', publish, vi.fn(), vi.fn());
    const first = queue.request();
    await Promise.resolve();
    queue.stop();
    await first;
    expect(publish).not.toHaveBeenCalled();
  });
});
