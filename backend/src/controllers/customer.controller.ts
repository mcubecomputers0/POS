import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from '../services/audit.service';

const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(200),
  customerType: z.enum(['B2C', 'B2B', 'export', 'other']).default('B2C'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  gstin: z.string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN')
    .optional()
    .or(z.literal('')),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN').optional().or(z.literal('')),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().max(2).optional(),
  pinCode: z.string().regex(/^\d{6}$/, 'Invalid PIN').optional().or(z.literal('')),
  country: z.string().default('India'),
  creditLimit: z.number().min(0).default(0),
  creditDays: z.number().min(0).default(0),
  openingBalance: z.number().default(0),
  notes: z.string().optional(),
});

export class CustomerController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { page = '1', limit = '20', search = '', customerType } = req.query as Record<string, string>;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = Math.min(parseInt(limit), 100);

      const where: any = {
        companyId,
        isActive: true,
        ...(customerType && { customerType }),
        ...(search && {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
            { gstin: { contains: search } },
          ],
        }),
      };

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take,
          include: {
            _count: { select: { invoices: true } },
          },
        }),
        prisma.customer.count({ where }),
      ]);

      // Calculate outstanding balances
      const customersWithBalances = await Promise.all(
        customers.map(async (customer) => {
          const outstanding = await prisma.invoice.aggregate({
            where: { companyId, customerId: customer.id, status: { not: 'cancelled' } },
            _sum: { balanceDue: true },
          });
          return {
            ...customer,
            openingBalance: customer.openingBalance / 100,
            outstandingAmount: (outstanding._sum.balanceDue ?? 0) / 100,
            invoiceCount: customer._count.invoices,
          };
        })
      );

      res.json({
        success: true,
        data: customersWithBalances,
        pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
      });
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const companyId = req.companyId!;

      const customer = await prisma.customer.findFirst({ where: { id, companyId } });
      if (!customer) throw new AppError('Customer not found.', 404);

      // Get ledger summary
      const [invoiceTotal, paymentTotal] = await Promise.all([
        prisma.invoice.aggregate({
          where: { companyId, customerId: id, status: { not: 'cancelled' } },
          _sum: { grandTotal: true, amountPaid: true, balanceDue: true },
          _count: true,
        }),
        prisma.payment.aggregate({
          where: { companyId, customerId: id, paymentType: 'receipt' },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      res.json({
        success: true,
        data: {
          ...customer,
          openingBalance: customer.openingBalance / 100,
          creditLimit: customer.creditLimit / 100,
          summary: {
            totalInvoices: invoiceTotal._count,
            totalBilled: (invoiceTotal._sum.grandTotal ?? 0) / 100,
            totalPaid: (invoiceTotal._sum.amountPaid ?? 0) / 100,
            totalOutstanding: (invoiceTotal._sum.balanceDue ?? 0) / 100,
            totalPayments: paymentTotal._count,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const data = customerSchema.parse(req.body);

      const customer = await prisma.customer.create({
        data: {
          companyId,
          ...data,
          email: data.email || null,
          gstin: data.gstin || null,
          pan: data.pan || null,
          pinCode: data.pinCode || null,
          creditLimit: Math.round(data.creditLimit * 100),
          openingBalance: Math.round(data.openingBalance * 100),
        },
      });

      AuditService.logAsync({
        companyId, userId: req.user!.id,
        action: 'create', module: 'customer',
        recordId: customer.id, description: `Customer created: ${customer.name}`,
      });

      res.status(201).json({ success: true, message: 'Customer created.', data: customer });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const companyId = req.companyId!;
      const data = customerSchema.partial().parse(req.body);

      const existing = await prisma.customer.findFirst({ where: { id, companyId } });
      if (!existing) throw new AppError('Customer not found.', 404);

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          ...data,
          ...(data.email !== undefined && { email: data.email || null }),
          ...(data.gstin !== undefined && { gstin: data.gstin || null }),
          ...(data.pan !== undefined && { pan: data.pan || null }),
          ...(data.creditLimit !== undefined && { creditLimit: Math.round(data.creditLimit * 100) }),
        },
      });

      AuditService.logAsync({
        companyId, userId: req.user!.id,
        action: 'update', module: 'customer',
        recordId: id, previousData: existing, newData: data,
      });

      res.json({ success: true, message: 'Customer updated.', data: updated });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const companyId = req.companyId!;

      const customer = await prisma.customer.findFirst({ where: { id, companyId } });
      if (!customer) throw new AppError('Customer not found.', 404);

      await prisma.customer.update({ where: { id }, data: { isActive: false } });
      res.json({ success: true, message: 'Customer deactivated.' });
    } catch (error) {
      next(error);
    }
  }

  static async getLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const companyId = req.companyId!;
      const { startDate, endDate } = req.query as Record<string, string>;

      const customer = await prisma.customer.findFirst({ where: { id, companyId } });
      if (!customer) throw new AppError('Customer not found.', 404);

      const dateFilter = startDate && endDate ? {
        gte: new Date(startDate),
        lte: new Date(endDate),
      } : undefined;

      const [invoices, payments] = await Promise.all([
        prisma.invoice.findMany({
          where: { companyId, customerId: id, status: { not: 'cancelled' }, ...(dateFilter && { invoiceDate: dateFilter }) },
          orderBy: { invoiceDate: 'asc' },
          select: { invoiceNumber: true, invoiceDate: true, grandTotal: true, amountPaid: true, balanceDue: true, status: true, paymentStatus: true },
        }),
        prisma.payment.findMany({
          where: { companyId, customerId: id, paymentType: 'receipt', ...(dateFilter && { paymentDate: dateFilter }) },
          orderBy: { paymentDate: 'asc' },
          select: { paymentNumber: true, paymentDate: true, amount: true, paymentMethod: true },
        }),
      ]);

      // Combine and sort for ledger
      const ledgerEntries = [
        ...invoices.map((inv) => ({
          date: inv.invoiceDate,
          type: 'invoice' as const,
          number: inv.invoiceNumber,
          debit: inv.grandTotal / 100,
          credit: inv.amountPaid / 100,
          balance: inv.balanceDue / 100,
        })),
        ...payments.map((pay) => ({
          date: pay.paymentDate,
          type: 'payment' as const,
          number: pay.paymentNumber,
          debit: 0,
          credit: pay.amount / 100,
          balance: 0,
        })),
      ].sort((a, b) => a.date.getTime() - b.date.getTime());

      res.json({ success: true, data: { customer, ledger: ledgerEntries } });
    } catch (error) {
      next(error);
    }
  }
}
