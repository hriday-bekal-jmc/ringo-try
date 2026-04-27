import { Router } from 'express';
import { ApplicationController } from '../controllers/applicationController';
import { ApprovalController } from '../controllers/approvalController';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRole, APPROVER_ROLES } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authenticate);

// Applications
router.get('/approvers', ApplicationController.getApprovers);
router.get('/', ApplicationController.listMine);
router.post('/', ApplicationController.create);
router.get('/:id', ApplicationController.getById);
router.put('/:id', ApplicationController.update);
router.post('/:id/submit', ApplicationController.submitDraft);
router.post('/:id/resubmit', ApplicationController.resubmit);

// Approvals (inbox)
router.get('/approvals/inbox', requireRole(...APPROVER_ROLES), ApprovalController.inbox);
router.post('/approvals/:id/action', requireRole(...APPROVER_ROLES), ApprovalController.takeAction);

export default router;
