import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { authenticate, requireCompany, requirePermission } from '../middleware/auth.middleware';
import { AppError } from '../middleware/errorHandler';
import { TaxService } from '../services/tax.service';

const router = Router();
router.use(authenticate, requireCompany);

// GST Reports
router.get('/gst/summary', requirePermission('reports', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const { startDate, endDate } = req.query as Record<string, string>;
    const dateFilter = {
      gte: startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 3, 1),
      lte: endDate ? new Date(endDate) : new Date(),
    };

    const [salesGst, purchaseGst] = await Promise.all([
      // Output GST (from sales)
      prisma.invoice.aggregate({
        where: { companyId, status: { not: 'cancelled' }, invoiceDate: dateFilter },
        _sum: { taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true, grandTotal: true },
      }),
      // Input GST (from purchases)
      prisma.purchase.aggregate({
        where: { companyId, status: { not: 'cancelled' }, purchaseDate: dateFilter },
        _sum: { taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true, grandTotal: true },
      }),
    ]);

    const outputTax = (salesGst._sum.cgstAmount ?? 0) + (salesGst._sum.sgstAmount ?? 0) + (salesGst._sum.igstAmount ?? 0);
    const inputTax = (purchaseGst._sum.cgstAmount ?? 0) + (purchaseGst._sum.sgstAmount ?? 0) + (purchaseGst._sum.igstAmount ?? 0);
    const taxPayable = Math.max(0, outputTax - inputTax);

    res.json({
      success: true,
      data: {
        dateRange: { start: dateFilter.gte, end: dateFilter.lte },
        output: {
          taxableAmount: TaxService.paiseToRupees(salesGst._sum.taxableAmount ?? 0),
          cgst: TaxService.paiseToRupees(salesGst._sum.cgstAmount ?? 0),
          sgst: TaxService.paiseToRupees(salesGst._sum.sgstAmount ?? 0),
          igst: TaxService.paiseToRupees(salesGst._sum.igstAmount ?? 0),
          cess: TaxService.paiseToRupees(salesGst._sum.cessAmount ?? 0),
          totalTax: TaxService.paiseToRupees(outputTax),
          totalSales: TaxService.paiseToRupees(salesGst._sum.grandTotal ?? 0),
        },
        input: {
          taxableAmount: TaxService.paiseToRupees(purchaseGst._sum.taxableAmount ?? 0),
          cgst: TaxService.paiseToRupees(purchaseGst._sum.cgstAmount ?? 0),
          sgst: TaxService.paiseToRupees(purchaseGst._sum.sgstAmount ?? 0),
          igst: TaxService.paiseToRupees(purchaseGst._sum.igstAmount ?? 0),
          cess: TaxService.paiseToRupees(purchaseGst._sum.cessAmount ?? 0),
          totalTax: TaxService.paiseToRupees(inputTax),
          totalPurchases: TaxService.paiseToRupees(purchaseGst._sum.grandTotal ?? 0),
        },
        netTaxPayable: TaxService.paiseToRupees(taxPayable),
      },
    });
  } catch (e) { next(e); }
});

// Sales Report
router.get('/sales', requirePermission('reports', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const { startDate, endDate, groupBy = 'day', customerId } = req.query as Record<string, string>;
    const dateFilter = {
      gte: startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      lte: endDate ? new Date(endDate) : new Date(),
    };

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId, status: { not: 'cancelled' },
        invoiceDate: dateFilter,
        ...(customerId && { customerId }),
      },
      include: { customer: { select: { name: true } }, items: { select: { totalAmount: true } } },
      orderBy: { invoiceDate: 'asc' },
    });

    const summary = {
      totalInvoices: invoices.length,
      totalAmount: TaxService.paiseToRupees(invoices.reduce((s, inv) => s + inv.grandTotal, 0)),
      totalPaid: TaxService.paiseToRupees(invoices.reduce((s, inv) => s + inv.amountPaid, 0)),
      totalOutstanding: TaxService.paiseToRupees(invoices.reduce((s, inv) => s + inv.balanceDue, 0)),
    };

    res.json({
      success: true,
      data: {
        summary,
        invoices: invoices.map((inv) => ({
          id: inv.id, invoiceNumber: inv.invoiceNumber, invoiceDate: inv.invoiceDate,
          customerName: inv.customer?.name ?? 'Walk-in',
          grandTotal: TaxService.paiseToRupees(inv.grandTotal),
          amountPaid: TaxService.paiseToRupees(inv.amountPaid),
          balanceDue: TaxService.paiseToRupees(inv.balanceDue),
          paymentStatus: inv.paymentStatus,
        })),
      },
    });
  } catch (e) { next(e); }
});

// Inventory Report
router.get('/inventory', requirePermission('reports', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const { warehouseId, lowStock, outOfStock } = req.query as Record<string, string>;

    const products = await prisma.product.findMany({
      where: { companyId, isActive: true, trackInventory: true },
      include: {
        category: { select: { name: true } },
        unit: { select: { name: true, abbreviation: true } },
        stockBalances: {
          where: warehouseId ? { warehouseId } : undefined,
          include: { warehouse: { select: { name: true } } },
        },
      },
    });

    const inventoryData = products.map((p) => {
      const totalStock = p.stockBalances.reduce((s, sb) => s + sb.quantity, 0);
      const stockValue = totalStock * p.purchasePrice;
      return {
        id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, hsnCode: p.hsnCode,
        category: p.category?.name, unit: p.unit?.abbreviation,
        purchasePrice: TaxService.paiseToRupees(p.purchasePrice),
        sellingPrice: TaxService.paiseToRupees(p.sellingPrice),
        totalStock, minStock: p.minStock,
        stockValue: TaxService.paiseToRupees(stockValue),
        isLowStock: totalStock > 0 && totalStock <= p.minStock,
        isOutOfStock: totalStock <= 0,
        warehouses: p.stockBalances.map((sb) => ({ warehouse: sb.warehouse.name, quantity: sb.quantity })),
      };
    });

    let filtered = inventoryData;
    if (lowStock === 'true') filtered = filtered.filter((p) => p.isLowStock);
    if (outOfStock === 'true') filtered = filtered.filter((p) => p.isOutOfStock);

    const totalValue = filtered.reduce((s, p) => s + p.stockValue, 0);
    res.json({
      success: true,
      data: {
        summary: {
          totalProducts: filtered.length,
          totalValue,
          lowStockCount: filtered.filter((p) => p.isLowStock).length,
          outOfStockCount: filtered.filter((p) => p.isOutOfStock).length,
        },
        products: filtered,
      },
    });
  } catch (e) { next(e); }
});

// HSN Summary (for GSTR-1)
router.get('/gst/hsn-summary', requirePermission('reports', 'view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const { startDate, endDate } = req.query as Record<string, string>;

    const items = await prisma.invoiceItem.findMany({
      where: {
        invoice: {
          companyId, status: { not: 'cancelled' },
          invoiceDate: {
            gte: startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 3, 1),
            lte: endDate ? new Date(endDate) : new Date(),
          },
        },
        hsnCode: { not: null },
      },
      select: { hsnCode: true, gstRate: true, quantity: true, taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true, totalAmount: true },
    });

    // Group by HSN code
    const hsnMap = new Map<string, any>();
    for (const item of items) {
      const key = `${item.hsnCode}-${item.gstRate}`;
      if (!hsnMap.has(key)) {
        hsnMap.set(key, { hsnCode: item.hsnCode, gstRate: item.gstRate, quantity: 0, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalAmount: 0 });
      }
      const entry = hsnMap.get(key);
      entry.quantity += parseFloat(item.quantity);
      entry.taxableAmount += item.taxableAmount;
      entry.cgst += item.cgstAmount;
      entry.sgst += item.sgstAmount;
      entry.igst += item.igstAmount;
      entry.cess += item.cessAmount;
      entry.totalAmount += item.totalAmount;
    }

    const hsnSummary = Array.from(hsnMap.values()).map((h) => ({
      ...h,
      taxableAmount: h.taxableAmount / 100,
      cgst: h.cgst / 100,
      sgst: h.sgst / 100,
      igst: h.igst / 100,
      cess: h.cess / 100,
      totalAmount: h.totalAmount / 100,
    }));

    res.json({ success: true, data: hsnSummary });
  } catch (e) { next(e); }
});

export default router;
