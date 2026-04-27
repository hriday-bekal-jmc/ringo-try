import { Router } from 'express';
import { AdminController } from '../controllers/adminController';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRole, ROLES } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authenticate, requireRole(ROLES.ADMIN));

router.get('/users', AdminController.listUsers);
router.put('/users/:userId', AdminController.updateUser);
router.get('/delegations', AdminController.listDelegations);
router.post('/users/:userId/delegations', AdminController.createDelegation);
router.get('/departments', AdminController.listDepartments);

export default router;
