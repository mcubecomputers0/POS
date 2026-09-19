import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate, requireCompany, requirePermission } from '../middleware/auth.middleware';
import { AppError } from '../middleware/errorHandler';
import { TaxService } from '../services/tax.service';
import { AuditService } from '../services/audit.service';

const router = Router();
router.use(authenticate, requireCompany);

const supplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  gstin: z.string().optional().or(z.literal('')),
  pan: z.string().optional().or(z.literal('')),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  pinCode: z.string().optional().or(z.literal('')),
  creditDays: z.number().default(0),
  openingBalance: z.number().default(0),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  notes: z.string().optional(),
});

router.get('/', requirePermission('suppliers', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', search = '' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);
    const where: any = {
      companyId: req.companyId!,
      isActive: true,
      ...(search && { OR: [{ name: { contains: search } }, { phone: { contains: search } }, { gstin: { contains: search } }] }),
    };
    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      prisma.supplier.count({ where }),
    ]);
    const suppliersWithBalances = await Promise.all(
      suppliers.map(async (s) => {
        const outstanding = await prisma.purchase.aggregate({
          where: { companyId: req.companyId!, supplierId: s.id, status: { not: 'cancelled' } },
          _sum: { balanceDue: true },
        });
        return { ...s, openingBalance: s.openingBalance / 100, outstandingAmount: (outstanding._sum.balanceDue ?? 0) / 100 };
      })
    );
    res.json({ success: true, data: suppliersWithBalances, pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) } });
  } catch (e) { next(e); }
});

router.get('/:id', requirePermission('suppliers', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await prisma.supplier.findFirst({ where: { id: req.params.id, companyId: req.companyId! } });
    if (!supplier) throw new AppError('Supplier not found.', 404);
    res.json({ success: true, data: { ...supplier, openingBalance: supplier.openingBalance / 100 } });
  } catch (e) { next(e); }
});

router.post('/', requirePermission('suppliers', 'add'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = supplierSchema.parse(req.body);
    const supplier = await prisma.supplier.create({
      data: { companyId: req.companyId!, ...data, email: data.email || null, gstin: data.gstin || null, pan: data.pan || null, openingBalance: Math.round(data.openingBalance * 100) },
    });
    AuditService.logAsync({ companyId: req.companyId!, userId: req.user!.id, action: 'create', module: 'supplier', recordId: supplier.id, description: `Supplier created: ${supplier.name}` });
    res.status(201).json({ success: true, message: 'Supplier created.', data: supplier });
  } catch (e) { next(e); }
});

router.put('/:id', requirePermission('suppliers', 'edit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.supplier.findFirst({ where: { id: req.params.id, companyId: req.companyId! } });
    if (!existing) throw new AppError('Supplier not found.', 404);
    const data = supplierSchema.partial().parse(req.body);
    const updated = await prisma.supplier.update({ where: { id: req.params.id }, data: { ...data, ...(data.openingBalance !== undefined && { openingBalance: Math.round(data.openingBalance * 100) }) } });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePermission('suppliers', 'delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.supplier.findFirst({ where: { id: req.params.id, companyId: req.companyId! } });
    if (!existing) throw new AppError('Supplier not found.', 404);
    await prisma.supplier.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Supplier deactivated.' });
  } catch (e) { next(e); }
});

export default router;
