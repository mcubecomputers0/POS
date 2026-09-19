import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from '../services/audit.service';
import { TaxService } from '../services/tax.service';
import { StockService, StockMovement } from '../services/stock.service';
import { NumberingService } from '../services/numbering.service';

const invoiceItemSchema = z.object({
  productId: z.string().nullable().optional(),
  warehouseId: z.string().nullable().optional(),
  description: z.string().min(1, 'Description is required'),
  hsnCode: z.string().nullable().optional(),
  quantity: z.string().default('1'),
  unit: z.string().nullable().optional(),
  rate: z.number().min(0),  // rupees
  discountPercent: z.string().default('0'),
  gstRate: z.string().default('18'),
  cessRate: z.string().default('0'),
  taxType: z.enum(['inclusive', 'exclusive']).optional(),
});

const invoiceSchema = z.object({
  customerId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  financialYearId: z.string().nullable().optional(),
  invoiceDate: z.string().optional().transform((d) => d ? new Date(d) : new Date()).default(() => new Date().toISOString()),
  dueDate: z.string().nullable().optional().transform((d) => d ? new Date(d) : undefined),
  placeOfSupply: z.string().nullable().optional(),
  isInterState: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  termsAndConditions: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  invoiceDiscountPercent: z.string().default('0'),
  paymentMethod: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  payments: z.array(z.object({
    method: z.string(),
    amount: z.number().min(0),
    referenceNo: z.string().optional(),
  })).optional().default([]),
});

export class InvoiceController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const {
        page = '1', limit = '20', search = '', status,
        customerId, startDate, endDate,
      } = req.query as Record<string, string>;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = Math.min(parseInt(limit), 100);

      const where: any = {
        companyId,
        ...(status && { status }),
        ...(customerId && { customerId }),
        ...(search && {
          OR: [
            { invoiceNumber: { contains: search } },
            { customer: { name: { contains: search } } },
          ],
        }),
        ...(startDate && endDate && {
          invoiceDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      };

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true, phone: true, gstin: true } },
            items: { select: { id: true } },
          },
          orderBy: { invoiceDate: 'desc' },
          skip,
          take,
        }),
        prisma.invoice.count({ where }),
      ]);

      res.json({
        success: true,
        data: invoices.map((inv) => {
          let customerName = inv.customer?.name;
          if (!inv.customer && inv.notes) {
            const match = inv.notes.match(/Walk-in:\s*([^•\n\r]+)/i);
            if (match) customerName = match[1].trim();
          }
          return {
            ...inv,
            customerName: customerName || null,
            grandTotal: inv.grandTotal,
            balanceDue: inv.balanceDue,
            balanceAmount: inv.balanceDue,
            amountPaid: inv.amountPaid,
            paidAmount: inv.amountPaid,
            itemCount: inv.items.length,
          };
        }),
        pagination: {
          page: parseInt(page),
          limit: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const companyId = req.companyId!;

      const invoice = await prisma.invoice.findFirst({
        where: { id, companyId },
        include: {
          customer: true,
          items: {
            include: {
              product: { select: { id: true, name: true, hsnCode: true } },
              warehouse: { select: { id: true, name: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
          payments: {
            orderBy: { paymentDate: 'desc' },
          },
        },
      });

      if (!invoice) throw new AppError('Invoice not found.', 404);

      // Get company details for invoice rendering
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          settings: true,
          bankAccounts: { where: { isPrimary: true } },
        },
      });

      let customerName = invoice.customer?.name;
      let customerPhone = invoice.customer?.phone;
      let displayNotes = invoice.notes;

      if (!invoice.customer && invoice.notes) {
        const match = invoice.notes.match(/Walk-in:\s*([^•\n\r]+)(?:\s*•\s*([^\n\r]+))?/i);
        if (match) {
          customerName = match[1].trim();
          if (match[2]) customerPhone = match[2].trim();
          displayNotes = invoice.notes.replace(/Walk-in:\s*[^\n\r]+[\n\r]?/i, '').trim() || null;
        }
      }

      const invoiceData = {
        ...invoice,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        notes: displayNotes,
        company,
        amountPaid: invoice.amountPaid,
        paidAmount: invoice.amountPaid,
        balanceDue: invoice.balanceDue,
        balanceAmount: invoice.balanceDue,
        amountInWords: TaxService.amountToWords(invoice.grandTotal),
      };

      res.json({
        success: true,
        data: {
          ...invoiceData,
          invoice: invoiceData,
          company,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const data = invoiceSchema.parse(req.body);

      // Get current financial year
      const financialYear = await prisma.financialYear.findFirst({
        where: { companyId, isCurrent: true },
      });

      // Get default warehouse for stock
      const defaultWarehouse = await prisma.warehouse.findFirst({
        where: { companyId, isDefault: true },
      });

      // Prepare items for tax calculation
      const taxItems = data.items.map((item) => ({
        description: item.description,
        hsnCode: item.hsnCode || undefined,
        quantity: item.quantity,
        rate: TaxService.rupeesToPaise(item.rate),  // convert to paise
        discountPercent: item.discountPercent,
        gstRate: item.gstRate,
        cessRate: item.cessRate,
        taxType: item.taxType,
      }));

      // Run centralized GST calculation
      const taxResult = TaxService.calculate(taxItems, {
        isInterState: data.isInterState,
        invoiceDiscountPercent: data.invoiceDiscountPercent,
        roundOff: true,
      });

      // Check stock availability for products with inventory tracking
      const stockChecks = await Promise.all(
        data.items
          .filter((item) => item.productId)
          .map(async (item, index) => {
            const product = await prisma.product.findFirst({
              where: { id: item.productId!, companyId },
            });
            if (!product) throw new AppError(`Product not found: ${item.description}`, 404);

            const warehouseId = item.warehouseId || defaultWarehouse?.id;
            if (!warehouseId) return null;

            if (product.trackInventory && !product.isService) {
              const available = await prisma.stockBalance.findUnique({
                where: { productId_warehouseId: { productId: product.id, warehouseId } },
              });
              const qty = parseFloat(item.quantity);
              const currentStock = available?.quantity ?? 0;
              if (currentStock < qty) {
                throw new AppError(
                  `Insufficient stock for "${product.name}". Available: ${currentStock}, Required: ${qty}`,
                  400
                );
              }
            }

            return {
              productId: product.id,
              warehouseId,
              quantity: -Math.round(parseFloat(item.quantity)),
              trackInventory: product.trackInventory && !product.isService,
            };
          })
      );

      // Calculate total payment amount
      const effectivePayments = (data.payments && data.payments.length > 0)
        ? data.payments
        : data.paymentMethod
          ? [{ method: data.paymentMethod, amount: TaxService.paiseToRupees(taxResult.grandTotal) }]
          : [];

      const totalPaymentAmount = effectivePayments.reduce(
        (sum, p) => sum + TaxService.rupeesToPaise(p.amount),
        0
      );

      const invoice = await prisma.$transaction(async (tx) => {
        // If walk-in details provided without customerId, find or create customer
        let effectiveCustomerId = data.customerId || null;
        if (!effectiveCustomerId && (data.customerName || data.customerPhone)) {
          let cust = null;
          if (data.customerPhone) {
            cust = await tx.customer.findFirst({
              where: { companyId, phone: data.customerPhone },
            });
          }
          if (!cust) {
            cust = await tx.customer.create({
              data: {
                companyId,
                name: data.customerName || `Walk-in (${data.customerPhone})`,
                phone: data.customerPhone || null,
                customerType: 'B2C',
              },
            });
          }
          effectiveCustomerId = cust.id;
        }

        // Generate invoice number atomically
        const invoiceNumber = await NumberingService.getNextNumber(
          tx,
          companyId,
          'invoice',
          financialYear?.id
        );

        const inv = await tx.invoice.create({
          data: {
            companyId,
            customerId: effectiveCustomerId,
            financialYearId: financialYear?.id ?? null,
            invoiceNumber,
            invoiceDate: data.invoiceDate,
            dueDate: data.dueDate ?? null,
            placeOfSupply: data.placeOfSupply ?? null,
            isInterState: data.isInterState,
            status: 'confirmed',
            paymentStatus: totalPaymentAmount >= taxResult.grandTotal ? 'paid'
              : totalPaymentAmount > 0 ? 'partial' : 'unpaid',
            subtotal: taxResult.subtotal,
            discountAmount: taxResult.totalDiscountAmount,
            taxableAmount: taxResult.taxableAmount,
            cgstAmount: taxResult.cgstAmount,
            sgstAmount: taxResult.sgstAmount,
            igstAmount: taxResult.igstAmount,
            cessAmount: taxResult.cessAmount,
            totalTax: taxResult.totalTax,
            roundOff: taxResult.roundOff,
            grandTotal: taxResult.grandTotal,
            amountPaid: totalPaymentAmount,
            balanceDue: Math.max(0, taxResult.grandTotal - totalPaymentAmount),
            notes: data.notes ?? null,
            termsAndConditions: data.termsAndConditions ?? null,
            templateId: data.templateId ?? null,
            createdByUserId: req.user!.id,
          },
        });

        // Create invoice items
        await tx.invoiceItem.createMany({
          data: taxResult.items.map((calcItem, i) => {
            const origItem = data.items[i];
            return {
              invoiceId: inv.id,
              productId: origItem.productId || null,
              warehouseId: origItem.warehouseId || defaultWarehouse?.id || null,
              description: origItem.description,
              hsnCode: origItem.hsnCode || null,
              quantity: origItem.quantity,
              unit: origItem.unit || null,
              rate: calcItem.rate,
              discountPercent: calcItem.discountPercent,
              discountAmount: calcItem.discountAmount,
              taxableAmount: calcItem.taxableAmount,
              gstRate: calcItem.gstRate,
              cessRate: calcItem.cessRate,
              cgstPercent: calcItem.cgstPercent,
              sgstPercent: calcItem.sgstPercent,
              igstPercent: calcItem.igstPercent,
              cgstAmount: calcItem.cgstAmount,
              sgstAmount: calcItem.sgstAmount,
              igstAmount: calcItem.igstAmount,
              cessAmount: calcItem.cessAmount,
              totalAmount: calcItem.totalAmount,
              sortOrder: i,
            };
          }),
        });

        // Deduct stock atomically
        const stockMovements: StockMovement[] = stockChecks
          .filter((sc) => sc !== null && sc.trackInventory)
          .map((sc) => ({
            productId: sc!.productId,
            warehouseId: sc!.warehouseId,
            quantity: sc!.quantity,
            transactionType: 'sale' as const,
            referenceType: 'invoice',
            referenceId: inv.id,
            createdByUserId: req.user!.id,
          }));

        if (stockMovements.length > 0) {
          await StockService.processMovements(tx, companyId, stockMovements);
        }

        // Record payments
        if (effectivePayments.length > 0) {
          for (let pi = 0; pi < effectivePayments.length; pi++) {
            const payment = effectivePayments[pi];
            await tx.payment.create({
              data: {
                companyId,
                paymentType: 'receipt',
                customerId: effectiveCustomerId,
                invoiceId: inv.id,
                paymentNumber: `PAY-${Date.now()}-${pi + 1}`,
                paymentDate: data.invoiceDate,
                amount: TaxService.rupeesToPaise(payment.amount),
                paymentMethod: payment.method,
                referenceNo: payment.referenceNo ?? null,
                createdByUserId: req.user!.id,
              },
            });
          }
        }

        return inv;
      });

      AuditService.logAsync({
        companyId,
        userId: req.user!.id,
        action: 'create',
        module: 'invoice',
        recordId: invoice.id,
        description: `Invoice ${invoice.invoiceNumber} created. Amount: ₹${TaxService.paiseToRupees(taxResult.grandTotal)}`,
      });

      res.status(201).json({
        success: true,
        message: `Invoice ${invoice.invoiceNumber} created successfully.`,
        data: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          grandTotal: TaxService.paiseToRupees(invoice.grandTotal),
          paymentStatus: invoice.paymentStatus,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const companyId = req.companyId!;
      const { reason } = req.body;

      const invoice = await prisma.invoice.findFirst({
        where: { id, companyId },
        include: {
          items: true,
        },
      });

      if (!invoice) throw new AppError('Invoice not found.', 404);
      if (invoice.status === 'cancelled') throw new AppError('Invoice is already cancelled.', 400);

      const defaultWarehouse = await prisma.warehouse.findFirst({
        where: { companyId, isDefault: true },
      });

      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelReason: reason ?? null,
          },
        });

        // Reverse stock deductions
        const reversalMovements: StockMovement[] = invoice.items
          .filter((item) => item.productId && item.warehouseId)
          .map((item) => ({
            productId: item.productId!,
            warehouseId: item.warehouseId || defaultWarehouse?.id || '',
            quantity: Math.round(parseFloat(item.quantity)), // positive (stock comes back)
            transactionType: 'sales_return' as const,
            referenceType: 'invoice_cancellation',
            referenceId: invoice.id,
            notes: `Invoice ${invoice.invoiceNumber} cancelled`,
            createdByUserId: req.user!.id,
          }))
          .filter((m) => m.warehouseId);

        if (reversalMovements.length > 0) {
          await StockService.processMovements(tx, companyId, reversalMovements);
        }
      });

      AuditService.logAsync({
        companyId,
        userId: req.user!.id,
        action: 'cancel',
        module: 'invoice',
        recordId: id,
        description: `Invoice ${invoice.invoiceNumber} cancelled. Reason: ${reason}`,
      });

      res.json({ success: true, message: `Invoice ${invoice.invoiceNumber} cancelled.` });
    } catch (error) {
      next(error);
    }
  }
}
