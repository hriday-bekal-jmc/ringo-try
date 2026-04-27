import { Router } from 'express';
import { EventsController } from '../controllers/eventsController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();
router.get('/stream', authenticate, EventsController.stream);
export default router;
