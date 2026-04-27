import { Router } from 'express';
import { AdminController } from '../controllers/adminController';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRole, ROLES } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authenticate, requireRole(ROLES.ADMIN));

router.get('/users',                       AdminController.listUsers);
router.post('/users',                      AdminController.createUser);
router.get('/users/:userId',               AdminController.getUser);
router.put('/users/:userId',               AdminController.updateUser);
router.put('/users/:userId/password',      AdminController.resetPassword);
router.get('/delegations',                 AdminController.listDelegations);
router.post('/users/:userId/delegations',  AdminController.createDelegation);
router.get('/departments',                 AdminController.listDepartments);

export default router;
