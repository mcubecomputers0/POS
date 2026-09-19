// Consolidated stub routes for remaining modules
// Each exports a Router with proper authentication and basic CRUD operations

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate, requireCompany, requirePermission } from '../middleware/auth.middleware';
import { AppError } from '../middleware/errorHandler';
import { TaxService } from '../services/tax.service';
import { NumberingService } from '../services/numbering.service';

// ─────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────
export const userRouter = Router();
userRouter.use(authenticate);

userRouter.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, phone: true, profilePhoto: true, createdAt: true, lastLoginAt: true },
    });
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

userRouter.put('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ name: z.string().min(2).optional(), phone: z.string().optional() }).parse(req.body);
    const updated = await prisma.user.update({ where: { id: req.user!.id }, data });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// STAFF MANAGEMENT
// ─────────────────────────────────────────────────────────────────
export const staffRouter = Router();
staffRouter.use(authenticate, requireCompany);

staffRouter.get('/', requirePermission('staff', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const staff = await prisma.companyUser.findMany({
      where: { companyId: req.companyId! },
      include: { user: { select: { id: true, name: true, email: true, phone: true, profilePhoto: true, lastLoginAt: true, isActive: true } }, role: true },
    });
    res.json({ success: true, data: staff });
  } catch (e) { next(e); }
});

staffRouter.post('/', requirePermission('staff', 'add'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      name: z.string().min(2),
      email: z.string().email().toLowerCase(),
      phone: z.string().optional(),
      password: z.string().min(8),
      roleId: z.string(),
      designation: z.string().optional(),
      department: z.string().optional(),
    }).parse(req.body);

    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email: data.email } });
      if (!user) {
        user = await tx.user.create({ data: { name: data.name, email: data.email, phone: data.phone || null, passwordHash } });
      } else {
        await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      }

      const existingMember = await tx.companyUser.findUnique({ where: { companyId_userId: { companyId: req.companyId!, userId: user.id } } });
      if (existingMember) throw new AppError('This user is already a staff member.', 409);

      const companyUser = await tx.companyUser.create({
        data: { companyId: req.companyId!, userId: user.id, roleId: data.roleId, designation: data.designation, department: data.department },
        include: { user: { select: { id: true, name: true, email: true } }, role: true },
      });
      return companyUser;
    });

    res.status(201).json({ success: true, message: 'Staff member added.', data: result });
  } catch (e) { next(e); }
});

staffRouter.put('/:id', requirePermission('staff', 'edit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      roleId: z.string().optional(),
      designation: z.string().optional(),
      department: z.string().optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(8).optional().or(z.literal('')),
    }).parse(req.body);
    const existing = await prisma.companyUser.findFirst({ where: { id: req.params.id, companyId: req.companyId! } });
    if (!existing) throw new AppError('Staff member not found.', 404);
    if (existing.isOwner) throw new AppError('Cannot modify company owner.', 403);

    const { password, ...companyUserData } = data;
    if (password) {
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({ where: { id: existing.userId }, data: { passwordHash } });
    }

    const updated = await prisma.companyUser.update({
      where: { id: req.params.id },
      data: companyUserData,
      include: { user: { select: { id: true, name: true, email: true } }, role: true },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// ROLE MANAGEMENT
// ─────────────────────────────────────────────────────────────────
export const roleRouter = Router();
roleRouter.use(authenticate, requireCompany);

roleRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({
      where: { OR: [{ companyId: req.companyId! }, { companyId: null, isSystem: true }] },
      include: { permissions: { include: { permission: true } }, _count: { select: { companyUsers: true } } },
    });
    res.json({ success: true, data: roles });
  } catch (e) { next(e); }
});

roleRouter.post('/', requirePermission('roles', 'add'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ name: z.string().min(1), displayName: z.string(), permissionIds: z.array(z.string()) }).parse(req.body);
    const role = await prisma.$transaction(async (tx) => {
      const r = await tx.role.create({ data: { companyId: req.companyId!, name: data.name, displayName: data.displayName } });
      if (data.permissionIds.length > 0) {
        await tx.rolePermission.createMany({ data: data.permissionIds.map((pid) => ({ roleId: r.id, permissionId: pid, granted: true })) });
      }
      return r;
    });
    res.status(201).json({ success: true, data: role });
  } catch (e) { next(e); }
});

// All permissions list
roleRouter.get('/permissions', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
    res.json({ success: true, data: permissions });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// WAREHOUSE MANAGEMENT
// ─────────────────────────────────────────────────────────────────
export const warehouseRouter = Router();
warehouseRouter.use(authenticate, requireCompany);

warehouseRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { companyId: req.companyId!, isActive: true },
      include: { _count: { select: { stockBalances: true } } },
    });
    res.json({ success: true, data: warehouses });
  } catch (e) { next(e); }
});

warehouseRouter.post('/', requirePermission('warehouses', 'add'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ name: z.string().min(1), address: z.string().optional(), city: z.string().optional(), state: z.string().optional() }).parse(req.body);
    const warehouse = await prisma.warehouse.create({ data: { companyId: req.companyId!, ...data } });
    res.status(201).json({ success: true, data: warehouse });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// EXPENSE MANAGEMENT
// ─────────────────────────────────────────────────────────────────
export const expenseRouter = Router();
expenseRouter.use(authenticate, requireCompany);

expenseRouter.get('/', requirePermission('expenses', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', categoryId, startDate, endDate } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);
    const where: any = {
      companyId: req.companyId!,
      ...(categoryId && { categoryId }),
      ...(startDate && endDate && { expenseDate: { gte: new Date(startDate), lte: new Date(endDate) } }),
    };
    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({ where, include: { category: true }, orderBy: { expenseDate: 'desc' }, skip, take }),
      prisma.expense.count({ where }),
    ]);
    res.json({
      success: true,
      data: expenses.map((e) => ({ ...e, amount: e.amount / 100, totalAmount: e.totalAmount / 100 })),
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (e) { next(e); }
});

expenseRouter.post('/', requirePermission('expenses', 'add'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      categoryId: z.string().optional(),
      description: z.string().min(1),
      amount: z.number().min(0),
      gstAmount: z.number().min(0).default(0),
      expenseDate: z.string().transform((d) => new Date(d)),
      paymentMethod: z.string().default('cash'),
      referenceNo: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const amountPaise = TaxService.rupeesToPaise(data.amount);
    const gstPaise = TaxService.rupeesToPaise(data.gstAmount);

    const expense = await prisma.expense.create({
      data: {
        companyId: req.companyId!, categoryId: data.categoryId || null,
        description: data.description, amount: amountPaise, gstAmount: gstPaise,
        totalAmount: amountPaise + gstPaise, expenseDate: data.expenseDate,
        paymentMethod: data.paymentMethod, referenceNo: data.referenceNo ?? null,
        notes: data.notes ?? null, createdByUserId: req.user!.id,
      },
    });
    res.status(201).json({ success: true, message: 'Expense recorded.', data: expense });
  } catch (e) { next(e); }
});

// Expense Categories
expenseRouter.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cats = await prisma.expenseCategory.findMany({ where: { companyId: req.companyId! }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: cats });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// PAYMENT MANAGEMENT
// ─────────────────────────────────────────────────────────────────
export const paymentRouter = Router();
paymentRouter.use(authenticate, requireCompany);

paymentRouter.get('/', requirePermission('payments', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', paymentType, customerId, supplierId } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);
    const where: any = { companyId: req.companyId!, ...(paymentType && { paymentType }), ...(customerId && { customerId }), ...(supplierId && { supplierId }) };
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where, include: { customer: { select: { name: true } }, supplier: { select: { name: true } } },
        orderBy: { paymentDate: 'desc' }, skip, take,
      }),
      prisma.payment.count({ where }),
    ]);
    res.json({
      success: true,
      data: payments.map((p) => ({ ...p, amount: p.amount / 100 })),
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (e) { next(e); }
});

paymentRouter.post('/', requirePermission('payments', 'add'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      paymentType: z.enum(['receipt', 'payment']),
      customerId: z.string().optional(),
      supplierId: z.string().optional(),
      invoiceId: z.string().optional(),
      purchaseId: z.string().optional(),
      paymentDate: z.string().transform((d) => new Date(d)),
      amount: z.number().min(0.01),
      paymentMethod: z.string(),
      referenceNo: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          companyId: req.companyId!, paymentNumber: `PAY-${Date.now()}`,
          paymentType: data.paymentType, customerId: data.customerId || null,
          supplierId: data.supplierId || null, invoiceId: data.invoiceId || null,
          purchaseId: data.purchaseId || null, paymentDate: data.paymentDate,
          amount: TaxService.rupeesToPaise(data.amount), paymentMethod: data.paymentMethod,
          referenceNo: data.referenceNo || null, notes: data.notes || null,
          createdByUserId: req.user!.id,
        },
      });

      // Update invoice balance if linked
      if (data.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: data.invoiceId } });
        if (invoice) {
          const newPaid = invoice.amountPaid + TaxService.rupeesToPaise(data.amount);
          const newBalance = Math.max(0, invoice.grandTotal - newPaid);
          await tx.invoice.update({
            where: { id: data.invoiceId },
            data: {
              amountPaid: newPaid,
              balanceDue: newBalance,
              paymentStatus: newBalance === 0 ? 'paid' : 'partial',
            },
          });
        }
      }

      // Update purchase balance if linked
      if (data.purchaseId) {
        const purchase = await tx.purchase.findUnique({ where: { id: data.purchaseId } });
        if (purchase) {
          const newPaid = purchase.amountPaid + TaxService.rupeesToPaise(data.amount);
          const newBalance = Math.max(0, purchase.grandTotal - newPaid);
          await tx.purchase.update({
            where: { id: data.purchaseId },
            data: { amountPaid: newPaid, balanceDue: newBalance, paymentStatus: newBalance === 0 ? 'paid' : 'partial' },
          });
        }
      }

      return p;
    });

    res.status(201).json({ success: true, message: 'Payment recorded.', data: { ...payment, amount: payment.amount / 100 } });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────
export const notificationRouter = Router();
notificationRouter.use(authenticate, requireCompany);

notificationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { companyId: req.companyId!, OR: [{ userId: req.user!.id }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: notifications });
  } catch (e) { next(e); }
});

notificationRouter.put('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true, readAt: new Date() } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

notificationRouter.put('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({ where: { companyId: req.companyId!, userId: req.user!.id }, data: { isRead: true, readAt: new Date() } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────────
export const auditLogRouter = Router();
auditLogRouter.use(authenticate, requireCompany, requirePermission('audit_logs', 'view'));

auditLogRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', module, userId } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);
    const where: any = { companyId: req.companyId!, ...(module && { module }), ...(userId && { userId }) };
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' }, skip, take,
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ success: true, data: logs, pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) } });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────
export const settingsRouter = Router();
settingsRouter.use(authenticate, requireCompany);

settingsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.companySetting.findUnique({ where: { companyId: req.companyId! } });
    res.json({ success: true, data: settings });
  } catch (e) { next(e); }
});

settingsRouter.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.companySetting.upsert({
      where: { companyId: req.companyId! },
      create: { companyId: req.companyId!, ...req.body },
      update: req.body,
    });
    res.json({ success: true, data: settings });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────────────────────────
export const templateRouter = Router();
templateRouter.use(authenticate, requireCompany);

templateRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.invoiceTemplate.findMany({ where: { companyId: req.companyId! } });
    res.json({ success: true, data: templates.map((t) => ({ ...t, config: JSON.parse(t.config || '{}') })) });
  } catch (e) { next(e); }
});

templateRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, templateType, isDefault, config } = req.body;
    if (isDefault) {
      await prisma.invoiceTemplate.updateMany({ where: { companyId: req.companyId! }, data: { isDefault: false } });
    }
    const template = await prisma.invoiceTemplate.create({
      data: { companyId: req.companyId!, name, templateType: templateType || 'classic', isDefault: isDefault || false, config: JSON.stringify(config || {}) },
    });
    res.status(201).json({ success: true, data: template });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// SUPPORT TICKETS
// ─────────────────────────────────────────────────────────────────
export const supportRouter = Router();
supportRouter.use(authenticate);

supportRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: req.user!.id },
      include: { replies: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: tickets });
  } catch (e) { next(e); }
});

supportRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ subject: z.string().min(1), description: z.string().min(1), priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'), category: z.string().optional() }).parse(req.body);
    const ticket = await prisma.supportTicket.create({ data: { ...data, userId: req.user!.id, companyId: req.companyId ?? null } });
    res.status(201).json({ success: true, data: ticket });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// SALES RETURNS
// ─────────────────────────────────────────────────────────────────
export const salesReturnRouter = Router();
salesReturnRouter.use(authenticate, requireCompany);

salesReturnRouter.get('/', requirePermission('sales_returns', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const returns = await prisma.salesReturn.findMany({
      where: { companyId: req.companyId! },
      include: { customer: { select: { name: true } }, invoice: { select: { invoiceNumber: true } } },
      orderBy: { returnDate: 'desc' },
    });
    res.json({ success: true, data: returns.map((r) => ({ ...r, grandTotal: r.grandTotal / 100 })) });
  } catch (e) { next(e); }
});

salesReturnRouter.post('/', requirePermission('sales_returns', 'add'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const data = z.object({
      invoiceId: z.string().optional(),
      customerId: z.string().optional(),
      returnDate: z.string().transform((d) => new Date(d)),
      reason: z.string().optional(),
      refundMethod: z.string().optional(),
      items: z.array(z.object({ productId: z.string().optional(), description: z.string(), quantity: z.string(), rate: z.number(), gstRate: z.string().default('18'), warehouseId: z.string().optional() })).min(1),
    }).parse(req.body);

    const financialYear = await prisma.financialYear.findFirst({ where: { companyId, isCurrent: true } });
    const defaultWarehouse = await prisma.warehouse.findFirst({ where: { companyId, isDefault: true } });

    const taxResult = TaxService.calculate(data.items.map((item) => ({ description: item.description, quantity: item.quantity, rate: TaxService.rupeesToPaise(item.rate), gstRate: item.gstRate })), { isInterState: false });

    const ret = await prisma.$transaction(async (tx) => {
      const returnNumber = await NumberingService.getNextNumber(tx, companyId, 'sales_return', financialYear?.id);
      const r = await tx.salesReturn.create({
        data: {
          companyId, invoiceId: data.invoiceId || null, customerId: data.customerId || null,
          returnNumber, returnDate: data.returnDate, reason: data.reason || null,
          taxableAmount: taxResult.taxableAmount, cgstAmount: taxResult.cgstAmount,
          sgstAmount: taxResult.sgstAmount, igstAmount: taxResult.igstAmount,
          grandTotal: taxResult.grandTotal, refundMethod: data.refundMethod || null,
          createdByUserId: req.user!.id,
        },
      });
      await tx.salesReturnItem.createMany({
        data: taxResult.items.map((calcItem, i) => ({
          salesReturnId: r.id, productId: data.items[i].productId || null,
          description: data.items[i].description, quantity: data.items[i].quantity,
          rate: calcItem.rate, taxableAmount: calcItem.taxableAmount,
          cgstAmount: calcItem.cgstAmount, sgstAmount: calcItem.sgstAmount,
          igstAmount: calcItem.igstAmount, totalAmount: calcItem.totalAmount,
        })),
      });
      // Restore stock
      const movements = data.items.filter((item) => item.productId).map((item) => ({
        productId: item.productId!, warehouseId: item.warehouseId || defaultWarehouse?.id || '',
        quantity: Math.round(parseFloat(item.quantity)), transactionType: 'sales_return' as const,
        referenceType: 'sales_return', referenceId: r.id, createdByUserId: req.user!.id,
      })).filter((m) => m.warehouseId);
      if (movements.length > 0) await (await import('../services/stock.service')).StockService.processMovements(tx, companyId, movements);
      return r;
    });

    res.status(201).json({ success: true, message: `Sales return ${ret.returnNumber} created.`, data: { id: ret.id, returnNumber: ret.returnNumber } });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// PURCHASE RETURNS
// ─────────────────────────────────────────────────────────────────
export const purchaseReturnRouter = Router();
purchaseReturnRouter.use(authenticate, requireCompany);

purchaseReturnRouter.get('/', requirePermission('purchase_returns', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const returns = await prisma.purchaseReturn.findMany({
      where: { companyId: req.companyId! },
      include: { supplier: { select: { name: true } } },
      orderBy: { returnDate: 'desc' },
    });
    res.json({ success: true, data: returns.map((r) => ({ ...r, grandTotal: r.grandTotal / 100 })) });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// QUOTATIONS
// ─────────────────────────────────────────────────────────────────
export const quotationRouter = Router();
quotationRouter.use(authenticate, requireCompany);

quotationRouter.get('/', requirePermission('quotations', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quotations = await prisma.quotation.findMany({
      where: { companyId: req.companyId! },
      include: { customer: { select: { name: true } } },
      orderBy: { quotationDate: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: quotations.map((q) => ({ ...q, grandTotal: q.grandTotal / 100 })) });
  } catch (e) { next(e); }
});

quotationRouter.get('/:id', requirePermission('quotations', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quotation = await prisma.quotation.findFirst({
      where: { id: req.params.id, companyId: req.companyId! },
      include: { customer: true, items: { include: { product: true } } },
    });
    if (!quotation) throw new AppError('Quotation not found.', 404);
    res.json({ success: true, data: { ...quotation, grandTotal: quotation.grandTotal / 100 } });
  } catch (e) { next(e); }
});

quotationRouter.post('/', requirePermission('quotations', 'add'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const data = z.object({
      customerId: z.string().optional(),
      quotationDate: z.string().transform((d) => new Date(d)),
      validUntil: z.string().optional().transform((d) => d ? new Date(d) : undefined),
      isInterState: z.boolean().default(false),
      notes: z.string().optional(),
      items: z.array(z.object({ productId: z.string().optional(), description: z.string(), quantity: z.string().default('1'), rate: z.number(), gstRate: z.string().default('18'), discountPercent: z.string().default('0') })).min(1),
    }).parse(req.body);

    const financialYear = await prisma.financialYear.findFirst({ where: { companyId, isCurrent: true } });
    const taxResult = TaxService.calculate(data.items.map((item) => ({ description: item.description, quantity: item.quantity, rate: TaxService.rupeesToPaise(item.rate), gstRate: item.gstRate, discountPercent: item.discountPercent })), { isInterState: data.isInterState });

    const quotation = await prisma.$transaction(async (tx) => {
      const quotationNumber = await NumberingService.getNextNumber(tx, companyId, 'quotation', financialYear?.id);
      const q = await tx.quotation.create({
        data: {
          companyId, customerId: data.customerId || null, quotationNumber,
          quotationDate: data.quotationDate, validUntil: data.validUntil ?? null,
          isInterState: data.isInterState, status: 'draft',
          subtotal: taxResult.subtotal, taxableAmount: taxResult.taxableAmount,
          cgstAmount: taxResult.cgstAmount, sgstAmount: taxResult.sgstAmount,
          igstAmount: taxResult.igstAmount, cessAmount: taxResult.cessAmount,
          grandTotal: taxResult.grandTotal, notes: data.notes ?? null,
          createdByUserId: req.user!.id,
        },
      });
      await tx.quotationItem.createMany({
        data: taxResult.items.map((calcItem, i) => ({
          quotationId: q.id, productId: data.items[i].productId || null,
          description: data.items[i].description, quantity: data.items[i].quantity,
          rate: calcItem.rate, discountPercent: calcItem.discountPercent,
          discountAmount: calcItem.discountAmount, taxableAmount: calcItem.taxableAmount,
          gstRate: calcItem.gstRate, cgstAmount: calcItem.cgstAmount,
          sgstAmount: calcItem.sgstAmount, igstAmount: calcItem.igstAmount,
          cessAmount: calcItem.cessAmount, totalAmount: calcItem.totalAmount, sortOrder: i,
        })),
      });
      return q;
    });
    res.status(201).json({ success: true, message: `Quotation ${quotation.quotationNumber} created.`, data: { id: quotation.id, quotationNumber: quotation.quotationNumber } });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// FILE UPLOAD
// ─────────────────────────────────────────────────────────────────
export const uploadRouter = Router();
uploadRouter.use(authenticate);

import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(process.cwd(), process.env.UPLOAD_DIR || './uploads', req.companyId || 'general');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '10')) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|xlsx|csv|doc|docx/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext || mime) cb(null, true);
    else cb(new Error('Invalid file type. Allowed: images, PDF, Excel, CSV, Word.'));
  },
});

uploadRouter.post('/image', upload.single('file'), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No file uploaded.', 400);
    const relativePath = `/uploads/${req.companyId || 'general'}/${req.file.filename}`;
    res.json({ success: true, data: { path: relativePath, filename: req.file.filename, size: req.file.size } });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// SUPER ADMIN
// ─────────────────────────────────────────────────────────────────
export const superAdminRouter = Router();
superAdminRouter.use(authenticate);

import { requireSuperAdmin } from '../middleware/auth.middleware';
superAdminRouter.use(requireSuperAdmin);

superAdminRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, totalCompanies, activeSubscriptions, totalInvoices] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.subscription.count({ where: { status: { in: ['active', 'trial'] } } }),
      prisma.invoice.count(),
    ]);
    res.json({ success: true, data: { totalUsers, totalCompanies, activeSubscriptions, totalInvoices } });
  } catch (e) { next(e); }
});

superAdminRouter.get('/companies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        include: { _count: { select: { invoices: true, companyUsers: true } } },
        orderBy: { createdAt: 'desc' }, skip, take,
      }),
      prisma.company.count(),
    ]);
    res.json({ success: true, data: companies, pagination: { page: parseInt(page), limit: take, total } });
  } catch (e) { next(e); }
});

superAdminRouter.put('/companies/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) throw new AppError('Company not found.', 404);
    const updated = await prisma.company.update({ where: { id: req.params.id }, data: { isActive: !company.isActive } });
    res.json({ success: true, data: updated, message: `Company ${updated.isActive ? 'activated' : 'deactivated'}.` });
  } catch (e) { next(e); }
});

superAdminRouter.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', search = '' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, select: { id: true, name: true, email: true, phone: true, isActive: true, isSuperAdmin: true, createdAt: true, lastLoginAt: true }, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ]);
    res.json({ success: true, data: users, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (e) { next(e); }
});

superAdminRouter.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ include: { user: { select: { name: true } }, company: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }),
      prisma.auditLog.count(),
    ]);
    res.json({ success: true, data: logs, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (e) { next(e); }
});

superAdminRouter.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: plans });
  } catch (e) { next(e); }
});

superAdminRouter.get('/announcements', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const announcements = await prisma.announcement.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: announcements });
  } catch (e) { next(e); }
});

superAdminRouter.post('/announcements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ title: z.string().min(1), content: z.string().min(1), type: z.enum(['info', 'warning', 'maintenance', 'feature']).default('info'), endsAt: z.string().optional() }).parse(req.body);
    const ann = await prisma.announcement.create({ data: { ...data, endsAt: data.endsAt ? new Date(data.endsAt) : null } });
    res.status(201).json({ success: true, data: ann });
  } catch (e) { next(e); }
});
