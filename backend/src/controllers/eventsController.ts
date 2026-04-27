import { Request, Response } from 'express';
import { sseManager } from '../services/sseService';

export const EventsController = {
  stream(req: Request, res: Response): void {
    const { userId } = req.user!;

    // Required SSE headers — X-Accel-Buffering disables Nginx proxy buffering
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const cleanup = sseManager.register(userId, res);

    // Confirm connection immediately so the client knows it's live
    res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);

    // Heartbeat every 25s — prevents proxies and load balancers from killing idle connections
    const heartbeat = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      cleanup();
    });
  },
};
