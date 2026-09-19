import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller';
import { authenticate, requireCompany } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', CompanyController.list);
router.post('/', CompanyController.create);
router.get('/:id', CompanyController.get);
router.put('/:id', CompanyController.update);

// Company-scoped routes (require X-Company-Id header)
router.get('/:id/stats', requireCompany, CompanyController.getStats);
router.put('/:id/settings', requireCompany, CompanyController.updateSettings);

export default router;
