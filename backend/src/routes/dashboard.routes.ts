import { Router } from 'express';
import { authenticate, requireCompany } from '../middleware/auth.middleware';
import { DashboardController } from '../controllers/dashboard.controller';

const router = Router();
router.use(authenticate, requireCompany);
router.get('/summary', DashboardController.getSummary);

export default router;
