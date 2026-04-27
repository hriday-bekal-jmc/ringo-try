import { Router } from 'express';
import { SettlementController } from '../controllers/settlementController';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRole, ROLES } from '../middlewares/roleMiddleware';

const router = Router();

router.use(authenticate, requireRole(ROLES.ACCOUNTING, ROLES.ADMIN));

router.get('/', SettlementController.listPending);
router.get('/export/status', SettlementController.checkExportStatus);
router.post('/export', SettlementController.triggerExport);
router.post('/upload-url', SettlementController.getUploadUrl);
router.get('/:id', SettlementController.getById);
router.post('/:id/receipts', SettlementController.attachReceipt);
router.post('/:id/settle', SettlementController.markSettled);

export default router;
