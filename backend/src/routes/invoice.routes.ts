import { Router } from 'express';
import { authenticate, requireCompany, requirePermission } from '../middleware/auth.middleware';
import { InvoiceController } from '../controllers/invoice.controller';

const router = Router();
router.use(authenticate, requireCompany);

router.get('/', requirePermission('invoices', 'view'), InvoiceController.list);
router.get('/:id', requirePermission('invoices', 'view'), InvoiceController.get);
router.post('/', requirePermission('invoices', 'add'), InvoiceController.create);
router.post('/:id/cancel', requirePermission('invoices', 'cancel'), InvoiceController.cancel);

export default router;
