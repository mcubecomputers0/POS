import { Router } from 'express';
import { authenticate, requireCompany, requirePermission } from '../middleware/auth.middleware';
import { ProductController } from '../controllers/product.controller';

const router = Router();
router.use(authenticate, requireCompany);

router.get('/', requirePermission('products', 'view'), ProductController.list);
router.get('/stock-movements', requirePermission('products', 'view'), ProductController.stockMovements);
router.get('/barcode/:barcode', requirePermission('products', 'view'), ProductController.searchByBarcode);
router.get('/:id', requirePermission('products', 'view'), ProductController.get);
router.post('/', requirePermission('products', 'add'), ProductController.create);
router.post('/stock-adjust', requirePermission('products', 'edit'), ProductController.stockAdjust);
router.put('/:id', requirePermission('products', 'edit'), ProductController.update);
router.delete('/:id', requirePermission('products', 'delete'), ProductController.delete);

export default router;
