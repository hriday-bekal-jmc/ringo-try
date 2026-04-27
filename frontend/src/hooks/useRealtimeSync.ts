import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

interface SSEEvent {
  type: 'inbox_update' | 'application_update' | 'stats_update' | 'ping';
  data?: { applicationId?: string };
}

/**
 * Opens a single SSE connection per authenticated session.
 * Translates server push events into React Query cache invalidations
 * so the UI stays in sync without polling.
 *
 * Mounted once in AppShell — EventSource auto-reconnects on drop.
 */
export function useRealtimeSync(): void {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
    const es = new EventSource(`${base}/api/events/stream`, { withCredentials: true });

    es.onmessage = (e: MessageEvent<string>) => {
      let event: SSEEvent;
      try {
        event = JSON.parse(e.data) as SSEEvent;
      } catch {
        return;
      }

      switch (event.type) {
        case 'inbox_update':
          // Approver's inbox changed (new task arrived or one was resolved)
          void queryClient.invalidateQueries({ queryKey: ['approvals'] });
          break;

        case 'application_update':
          // Applicant's specific application status changed
          void queryClient.invalidateQueries({ queryKey: ['applications'] });
          break;

        case 'stats_update':
          // Dashboard stat counts changed
          void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          break;

        case 'ping':
          // Heartbeat — no action needed
          break;
      }
    };

    es.onerror = () => {
      // EventSource will automatically attempt to reconnect after a short delay.
      // No manual retry logic needed.
    };

    return () => es.close();
  // Re-connect only when the authenticated user identity changes (login/logout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
