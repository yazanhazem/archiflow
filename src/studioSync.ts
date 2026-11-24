export function createSyncQueue<T>(
  read: () => Promise<T>,
  publish: (data: T) => void,
  report: (error: unknown | null) => void,
  syncing: (value: boolean) => void,
) {
  let active = true;
  let requested = false;
  let revision = 0;
  let flight: Promise<void> | undefined;

  function request(invalidate = false): Promise<void> {
    if (!active) return Promise.resolve();
    if (invalidate) revision += 1;
    if (flight && !invalidate) return flight;
    requested = true;
    if (flight) return flight;

    syncing(true);
    flight = Promise.resolve().then(async () => {
      while (requested && active) {
        requested = false;
        const start = revision;
        try {
          const data = await read();
          if (active && start === revision) {
            publish(data);
            report(null);
          }
        } catch (error) {
          if (active && start === revision) report(error);
        }
      }
    }).finally(() => {
      flight = undefined;
      if (active) {
        if (requested) void request();
        else syncing(false);
      }
    });
    return flight;
  }

  return { request, stop: () => { active = false; } };
}

export function acknowledgeWrite<T>(result: { data: T; error: unknown }, refresh: () => Promise<void>, apply?: (data: T) => void) {
  if (result.error) throw result.error;
  apply?.(result.data);
  // A read failure belongs to sync. The already-committed write still returns its value.
  void Promise.resolve().then(refresh).catch(() => {});
  return result.data;
}
