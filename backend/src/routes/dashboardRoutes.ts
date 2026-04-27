import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();
router.use(authenticate);
router.get('/stats', DashboardController.stats);

export default router;
