import { Router } from 'express';
import { authenticate, requireCompany, requirePermission } from '../middleware/auth.middleware';
import { CustomerController } from '../controllers/customer.controller';

const router = Router();
router.use(authenticate, requireCompany);

router.get('/', requirePermission('customers', 'view'), CustomerController.list);
router.get('/:id', requirePermission('customers', 'view'), CustomerController.get);
router.get('/:id/ledger', requirePermission('customers', 'view'), CustomerController.getLedger);
router.post('/', requirePermission('customers', 'add'), CustomerController.create);
router.put('/:id', requirePermission('customers', 'edit'), CustomerController.update);
router.delete('/:id', requirePermission('customers', 'delete'), CustomerController.delete);

export default router;
