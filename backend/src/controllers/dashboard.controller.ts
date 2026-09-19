import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { TaxService } from '../services/tax.service';

export class DashboardController {
  static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { period = 'today' } = req.query as { period: string };

      const { startDate, endDate } = DashboardController.getDateRange(period, req.query);

      const [
        salesData,
        purchaseData,
        expenseData,
        receivables,
        payables,
        totalCustomers,
        totalSuppliers,
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        topProducts,
        salesByDay,
        paymentMethods,
        gstSummary,
      ] = await Promise.all([
        // Sales summary
        prisma.invoice.aggregate({
          where: {
            companyId,
            status: { not: 'cancelled' },
            invoiceDate: { gte: startDate, lte: endDate },
          },
          _sum: { grandTotal: true, taxableAmount: true, totalTax: true, amountPaid: true },
          _count: true,
        }),

        // Purchase summary
        prisma.purchase.aggregate({
          where: {
            companyId,
            status: { not: 'cancelled' },
            purchaseDate: { gte: startDate, lte: endDate },
          },
          _sum: { grandTotal: true },
          _count: true,
        }),

        // Expense summary
        prisma.expense.aggregate({
          where: {
            companyId,
            expenseDate: { gte: startDate, lte: endDate },
          },
          _sum: { totalAmount: true },
          _count: true,
        }),

        // Total receivables (all outstanding invoices)
        prisma.invoice.aggregate({
          where: { companyId, status: { not: 'cancelled' }, balanceDue: { gt: 0 } },
          _sum: { balanceDue: true },
        }),

        // Total payables (all outstanding purchases)
        prisma.purchase.aggregate({
          where: { companyId, status: { not: 'cancelled' }, balanceDue: { gt: 0 } },
          _sum: { balanceDue: true },
        }),

        prisma.customer.count({ where: { companyId, isActive: true } }),
        prisma.supplier.count({ where: { companyId, isActive: true } }),
        prisma.product.count({ where: { companyId, isActive: true } }),

        // Low stock: fetch all trackable products then filter in JS
        prisma.product.findMany({
          where: {
            companyId,
            isActive: true,
            trackInventory: true,
            minStock: { gt: 0 },
          },
          take: 50,
          select: {
            id: true, name: true, minStock: true,
            stockBalances: { select: { quantity: true } },
          },
        }),

        // Out of stock (no stock balances or all zero)
        prisma.product.count({
          where: {
            companyId,
            isActive: true,
            trackInventory: true,
            stockBalances: { none: { quantity: { gt: 0 } } },
          },
        }),

        // Top selling products
        prisma.invoiceItem.groupBy({
          by: ['productId'],
          where: {
            invoice: {
              companyId,
              status: { not: 'cancelled' },
              invoiceDate: { gte: startDate, lte: endDate },
            },
            productId: { not: null },
          },
          _sum: { totalAmount: true },
          orderBy: { _sum: { totalAmount: 'desc' } },
          take: 5,
        }),

        // Sales by day (last 30 days)
        prisma.invoice.groupBy({
          by: ['invoiceDate'],
          where: {
            companyId,
            status: { not: 'cancelled' },
            invoiceDate: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              lte: new Date(),
            },
          },
          _sum: { grandTotal: true },
          orderBy: { invoiceDate: 'asc' },
        }),

        // Payment methods breakdown
        prisma.payment.groupBy({
          by: ['paymentMethod'],
          where: {
            companyId,
            paymentType: 'receipt',
            paymentDate: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
          _count: true,
        }),

        // GST summary
        prisma.invoice.aggregate({
          where: {
            companyId,
            status: { not: 'cancelled' },
            invoiceDate: { gte: startDate, lte: endDate },
          },
          _sum: {
            taxableAmount: true,
            cgstAmount: true,
            sgstAmount: true,
            igstAmount: true,
            cessAmount: true,
          },
        }),
      ]);

      // Compute profit estimate (Sales - Purchases - Expenses)
      const totalSales = salesData._sum.grandTotal ?? 0;
      const totalPurchases = purchaseData._sum.grandTotal ?? 0;
      const totalExpenses = expenseData._sum.totalAmount ?? 0;
      const estimatedProfit = totalSales - totalPurchases - totalExpenses;

      // Enrich top products with names
      const topProductsEnriched = await Promise.all(
        topProducts.map(async (tp) => {
          const product = await prisma.product.findUnique({
            where: { id: tp.productId! },
            select: { id: true, name: true },
          });
          return {
            product,
            totalAmount: TaxService.paiseToRupees(tp._sum.totalAmount ?? 0),
          };
        })
      );

      res.json({
        success: true,
        data: {
          period,
          dateRange: { start: startDate, end: endDate },
          kpis: {
            totalSales: TaxService.paiseToRupees(totalSales),
            salesCount: salesData._count,
            totalPurchases: TaxService.paiseToRupees(totalPurchases),
            purchaseCount: purchaseData._count,
            totalExpenses: TaxService.paiseToRupees(totalExpenses),
            expenseCount: expenseData._count,
            estimatedProfit: TaxService.paiseToRupees(estimatedProfit),
            totalReceivables: TaxService.paiseToRupees(receivables._sum.balanceDue ?? 0),
            totalPayables: TaxService.paiseToRupees(payables._sum.balanceDue ?? 0),
            totalCustomers,
            totalSuppliers,
            totalProducts,
            outOfStockProducts,
            lowStockCount: lowStockProducts.length,
          },
          gstSummary: {
            taxableAmount: TaxService.paiseToRupees(gstSummary._sum.taxableAmount ?? 0),
            cgst: TaxService.paiseToRupees(gstSummary._sum.cgstAmount ?? 0),
            sgst: TaxService.paiseToRupees(gstSummary._sum.sgstAmount ?? 0),
            igst: TaxService.paiseToRupees(gstSummary._sum.igstAmount ?? 0),
            cess: TaxService.paiseToRupees(gstSummary._sum.cessAmount ?? 0),
          },
          charts: {
            salesByDay: salesByDay.map((s) => ({
              date: s.invoiceDate.toISOString().split('T')[0],
              amount: TaxService.paiseToRupees(s._sum.grandTotal ?? 0),
            })),
            paymentMethods: paymentMethods.map((pm) => ({
              method: pm.paymentMethod,
              amount: TaxService.paiseToRupees(pm._sum.amount ?? 0),
              count: pm._count,
            })),
            topProducts: topProductsEnriched,
          },
          alerts: {
            lowStockProducts: lowStockProducts
              .map((p: any) => ({
                id: p.id,
                name: p.name,
                minStock: p.minStock,
                currentStock: p.stockBalances.reduce((s: number, sb: any) => s + sb.quantity, 0),
              }))
              .filter((p: any) => p.currentStock <= p.minStock)
              .slice(0, 10),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private static getDateRange(
    period: string,
    query: Record<string, any>
  ): { startDate: Date; endDate: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    switch (period) {
      case 'today':
        return { startDate: today, endDate: tomorrow };
      case 'yesterday': {
        const yest = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return { startDate: yest, endDate: today };
      }
      case 'this_week': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return { startDate: startOfWeek, endDate: tomorrow };
      }
      case 'this_month': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: startOfMonth, endDate: tomorrow };
      }
      case 'last_month': {
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: startOfLastMonth, endDate: endOfLastMonth };
      }
      case 'this_quarter': {
        const quarter = Math.floor(today.getMonth() / 3);
        const startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1);
        return { startDate: startOfQuarter, endDate: tomorrow };
      }
      case 'this_fy': {
        // Indian FY: April to March
        const fyStart = today.getMonth() >= 3
          ? new Date(today.getFullYear(), 3, 1)
          : new Date(today.getFullYear() - 1, 3, 1);
        return { startDate: fyStart, endDate: tomorrow };
      }
      case 'custom': {
        return {
          startDate: new Date(query.startDate || today),
          endDate: new Date(query.endDate || tomorrow),
        };
      }
      default:
        return { startDate: today, endDate: tomorrow };
    }
  }
}
