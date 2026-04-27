import { Router } from 'express';
import { TemplateController } from '../controllers/templateController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', TemplateController.listAvailable);
router.get('/:id', TemplateController.getById);

export default router;
