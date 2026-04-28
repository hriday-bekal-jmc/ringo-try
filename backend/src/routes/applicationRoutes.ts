import { Router } from 'express';
import { ApplicationController } from '../controllers/applicationController';
import { ApprovalController } from '../controllers/approvalController';
import { StorageService } from '../services/storageService';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRole, APPROVER_ROLES } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authenticate);

// General file upload URL — any authenticated user (for application form attachments)
router.post('/upload-url', async (req, res) => {
  const { fileName, mimeType } = req.body as { fileName?: string; mimeType?: string };
  if (!fileName || !mimeType) {
    res.status(400).json({ error: 'fileName and mimeType are required.' });
    return;
  }
  const uploadUrl = await StorageService.generateUploadUrl(fileName, mimeType);
  res.json({ uploadUrl });
});

// Applications
router.get('/approvers', ApplicationController.getApprovers);
router.get('/', ApplicationController.listMine);
router.post('/', ApplicationController.create);
router.get('/:id', ApplicationController.getById);
router.put('/:id', ApplicationController.update);
router.post('/:id/submit', ApplicationController.submitDraft);
router.post('/:id/resubmit', ApplicationController.resubmit);

// Approvals
router.get('/approvals/inbox',   requireRole(...APPROVER_ROLES), ApprovalController.inbox);
router.get('/approvals/history', requireRole(...APPROVER_ROLES), ApprovalController.history);
router.get('/approvals/waiting', requireRole(...APPROVER_ROLES), ApprovalController.waiting);
router.post('/approvals/:id/action', requireRole(...APPROVER_ROLES), ApprovalController.takeAction);

export default router;
