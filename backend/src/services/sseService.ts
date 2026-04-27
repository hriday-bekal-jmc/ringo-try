import { Response } from 'express';

export interface SSEEvent {
  type: 'inbox_update' | 'application_update' | 'stats_update' | 'ping';
  data?: Record<string, unknown>;
}

class SSEManager {
  // One user can have multiple open tabs — each gets its own Response
  private readonly connections = new Map<string, Set<Response>>();

  register(userId: string, res: Response): () => void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(res);

    return () => {
      const set = this.connections.get(userId);
      if (set) {
        set.delete(res);
        if (set.size === 0) this.connections.delete(userId);
      }
    };
  }

  send(userId: string, event: SSEEvent): void {
    const set = this.connections.get(userId);
    if (!set || set.size === 0) return;
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of set) {
      try {
        res.write(payload);
      } catch {
        // Response already closed; cleanup happens via the 'close' event handler
      }
    }
  }

  broadcast(userIds: string[], event: SSEEvent): void {
    const unique = [...new Set(userIds)];
    for (const uid of unique) this.send(uid, event);
  }

  get activeConnectionCount(): number {
    let n = 0;
    for (const set of this.connections.values()) n += set.size;
    return n;
  }
}

export const sseManager = new SSEManager();
