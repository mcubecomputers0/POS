import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate, requireCompany, requirePermission } from '../middleware/auth.middleware';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from '../services/audit.service';

const router = Router();
router.use(authenticate, requireCompany);

// Categories
router.get('/', requirePermission('categories', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({
      where: { companyId: req.companyId! },
      include: { children: true, _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (e) { next(e); }
});

router.post('/', requirePermission('categories', 'add'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      parentId: z.string().optional(),
    }).parse(req.body);

    const category = await prisma.category.create({
      data: { companyId: req.companyId!, ...data, parentId: data.parentId || null },
    });
    res.status(201).json({ success: true, data: category });
  } catch (e) { next(e); }
});

router.put('/:id', requirePermission('categories', 'edit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.category.findFirst({ where: { id, companyId: req.companyId! } });
    if (!existing) throw new AppError('Category not found.', 404);
    const updated = await prisma.category.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePermission('categories', 'delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.category.findFirst({ where: { id, companyId: req.companyId! } });
    if (!existing) throw new AppError('Category not found.', 404);
    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) throw new AppError(`Cannot delete: ${productCount} products use this category.`, 409);
    await prisma.category.delete({ where: { id } });
    res.json({ success: true, message: 'Category deleted.' });
  } catch (e) { next(e); }
});

// Brands
router.get('/brands', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brands = await prisma.brand.findMany({ where: { companyId: req.companyId! }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: brands });
  } catch (e) { next(e); }
});

router.post('/brands', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ name: z.string().min(1), description: z.string().optional() }).parse(req.body);
    const brand = await prisma.brand.create({ data: { companyId: req.companyId!, ...data } });
    res.status(201).json({ success: true, data: brand });
  } catch (e) { next(e); }
});

// Units
router.get('/units', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const units = await prisma.unit.findMany({ where: { companyId: req.companyId! }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: units });
  } catch (e) { next(e); }
});

router.post('/units', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ name: z.string().min(1), abbreviation: z.string().min(1) }).parse(req.body);
    const unit = await prisma.unit.create({ data: { companyId: req.companyId!, ...data } });
    res.status(201).json({ success: true, data: unit });
  } catch (e) { next(e); }
});

export default router;
