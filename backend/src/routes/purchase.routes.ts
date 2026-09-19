import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate, requireCompany, requirePermission } from '../middleware/auth.middleware';
import { AppError } from '../middleware/errorHandler';
import { TaxService } from '../services/tax.service';
import { StockService } from '../services/stock.service';
import { NumberingService } from '../services/numbering.service';
import { AuditService } from '../services/audit.service';

const router = Router();
router.use(authenticate, requireCompany);

// Purchase schema
const purchaseItemSchema = z.object({
  productId: z.string().optional(),
  warehouseId: z.string().optional(),
  description: z.string().min(1),
  hsnCode: z.string().optional(),
  quantity: z.string().default('1'),
  unit: z.string().optional(),
  rate: z.number().min(0),
  mrp: z.number().min(0).default(0),
  discountPercent: z.string().default('0'),
  gstRate: z.string().default('18'),
  cessRate: z.string().default('0'),
});

const purchaseSchema = z.object({
  supplierId: z.string().optional(),
  supplierInvoiceNo: z.string().optional(),
  purchaseDate: z.string().transform((d) => new Date(d)),
  dueDate: z.string().optional().transform((d) => d ? new Date(d) : undefined),
  isInterState: z.boolean().default(false),
  freightCharges: z.number().default(0),
  otherCharges: z.number().default(0),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1),
  payments: z.array(z.object({ method: z.string(), amount: z.number().min(0) })).optional().default([]),
});

router.get('/', requirePermission('purchases', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', search = '' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);
    const where: any = {
      companyId: req.companyId!,
      ...(search && { OR: [{ purchaseNumber: { contains: search } }, { supplier: { name: { contains: search } } }] }),
    };
    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where, include: { supplier: { select: { id: true, name: true } } },
        orderBy: { purchaseDate: 'desc' }, skip, take,
      }),
      prisma.purchase.count({ where }),
    ]);
    res.json({
      success: true,
      data: purchases.map((p) => ({ ...p, grandTotal: p.grandTotal / 100, balanceDue: p.balanceDue / 100 })),
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (e) { next(e); }
});

router.get('/:id', requirePermission('purchases', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const purchase = await prisma.purchase.findFirst({
      where: { id: req.params.id, companyId: req.companyId! },
      include: { supplier: true, items: { include: { product: true, warehouse: true } }, payments: true },
    });
    if (!purchase) throw new AppError('Purchase not found.', 404);
    res.json({ success: true, data: { ...purchase, grandTotal: purchase.grandTotal / 100 } });
  } catch (e) { next(e); }
});

router.post('/', requirePermission('purchases', 'add'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const data = purchaseSchema.parse(req.body);
    const financialYear = await prisma.financialYear.findFirst({ where: { companyId, isCurrent: true } });
    const defaultWarehouse = await prisma.warehouse.findFirst({ where: { companyId, isDefault: true } });

    const taxItems = data.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      rate: TaxService.rupeesToPaise(item.rate),
      discountPercent: item.discountPercent,
      gstRate: item.gstRate,
      cessRate: item.cessRate,
    }));

    const taxResult = TaxService.calculate(taxItems, { isInterState: data.isInterState });
    const freightPaise = TaxService.rupeesToPaise(data.freightCharges);
    const otherPaise = TaxService.rupeesToPaise(data.otherCharges);
    const grandTotal = taxResult.grandTotal + freightPaise + otherPaise;
    const totalPayment = data.payments.reduce((s, p) => s + TaxService.rupeesToPaise(p.amount), 0);

    const purchase = await prisma.$transaction(async (tx) => {
      const purchaseNumber = await NumberingService.getNextNumber(tx, companyId, 'purchase', financialYear?.id);

      const p = await tx.purchase.create({
        data: {
          companyId, supplierId: data.supplierId || null, financialYearId: financialYear?.id ?? null,
          purchaseNumber, supplierInvoiceNo: data.supplierInvoiceNo || null,
          purchaseDate: data.purchaseDate, dueDate: data.dueDate ?? null,
          isInterState: data.isInterState, status: 'confirmed',
          paymentStatus: totalPayment >= grandTotal ? 'paid' : totalPayment > 0 ? 'partial' : 'unpaid',
          subtotal: taxResult.subtotal, discountAmount: taxResult.totalDiscountAmount,
          taxableAmount: taxResult.taxableAmount, cgstAmount: taxResult.cgstAmount,
          sgstAmount: taxResult.sgstAmount, igstAmount: taxResult.igstAmount,
          cessAmount: taxResult.cessAmount, freightCharges: freightPaise,
          otherCharges: otherPaise, roundOff: taxResult.roundOff, grandTotal,
          amountPaid: totalPayment, balanceDue: Math.max(0, grandTotal - totalPayment),
          notes: data.notes ?? null, createdByUserId: req.user!.id,
        },
      });

      await tx.purchaseItem.createMany({
        data: taxResult.items.map((calcItem, i) => {
          const origItem = data.items[i];
          return {
            purchaseId: p.id, productId: origItem.productId || null,
            warehouseId: origItem.warehouseId || defaultWarehouse?.id || null,
            description: origItem.description, hsnCode: origItem.hsnCode || null,
            quantity: origItem.quantity, unit: origItem.unit || null,
            rate: calcItem.rate, mrp: TaxService.rupeesToPaise(origItem.mrp),
            discountPercent: calcItem.discountPercent, discountAmount: calcItem.discountAmount,
            taxableAmount: calcItem.taxableAmount, gstRate: calcItem.gstRate,
            cgstPercent: calcItem.cgstPercent, sgstPercent: calcItem.sgstPercent,
            igstPercent: calcItem.igstPercent, cgstAmount: calcItem.cgstAmount,
            sgstAmount: calcItem.sgstAmount, igstAmount: calcItem.igstAmount,
            cessAmount: calcItem.cessAmount, totalAmount: calcItem.totalAmount, sortOrder: i,
          };
        }),
      });

      // Increase stock for all items with products
      const stockMovements = data.items
        .filter((item) => item.productId)
        .map((item) => ({
          productId: item.productId!,
          warehouseId: item.warehouseId || defaultWarehouse?.id || '',
          quantity: Math.round(parseFloat(item.quantity)),
          transactionType: 'purchase' as const,
          referenceType: 'purchase',
          referenceId: p.id,
          createdByUserId: req.user!.id,
        }))
        .filter((m) => m.warehouseId);

      if (stockMovements.length > 0) {
        await StockService.processMovements(tx, companyId, stockMovements);
      }

      for (const payment of data.payments) {
        await tx.payment.create({
          data: {
            companyId, paymentType: 'payment', supplierId: data.supplierId || null,
            purchaseId: p.id, paymentNumber: `PAY-${Date.now()}`,
            paymentDate: data.purchaseDate, amount: TaxService.rupeesToPaise(payment.amount),
            paymentMethod: payment.method, createdByUserId: req.user!.id,
          },
        });
      }
      return p;
    });

    AuditService.logAsync({ companyId, userId: req.user!.id, action: 'create', module: 'purchase', recordId: purchase.id, description: `Purchase ${purchase.purchaseNumber} created` });
    res.status(201).json({ success: true, message: `Purchase ${purchase.purchaseNumber} created.`, data: { id: purchase.id, purchaseNumber: purchase.purchaseNumber } });
  } catch (e) { next(e); }
});

export default router;
