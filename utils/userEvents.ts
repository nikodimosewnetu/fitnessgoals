// Simple in-memory pub/sub for user updates (works across modules)
type UserPayload = { name?: string; fullName?: string; email?: string; avatar?: string | null; weekStreak?: number };

const listeners = new Set<(user: UserPayload) => void>();

export function onUserChange(cb: (user: UserPayload) => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function emitUserChange(user: UserPayload) {
  for (const cb of Array.from(listeners)) {
    try {
      cb(user);
    } catch {
      // ignore listener errors
    }
  }
}

export default { onUserChange, emitUserChange };
