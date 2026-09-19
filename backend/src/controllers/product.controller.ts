import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from '../services/audit.service';
import { TaxService } from '../services/tax.service';

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(300),
  description: z.string().optional(),
  productCode: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  hsnCode: z.string().optional(),
  isService: z.boolean().default(false),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  unitId: z.string().optional(),
  purchasePrice: z.number().min(0).default(0),  // rupees
  sellingPrice: z.number().min(0).default(0),   // rupees
  mrp: z.number().min(0).default(0),
  wholesalePrice: z.number().min(0).default(0),
  gstRate: z.enum(['0', '0.1', '0.25', '1.5', '3', '5', '12', '18', '28']).default('18'),
  cessRate: z.string().default('0'),
  taxType: z.enum(['inclusive', 'exclusive']).default('exclusive'),
  openingStock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(0),
  maxStock: z.number().min(0).default(0),
  trackInventory: z.boolean().default(true),
  warehouseId: z.string().optional(),
});

export class ProductController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const {
        page = '1', limit = '20', search = '', categoryId, isActive,
        lowStock, outOfStock, sortBy = 'name', sortOrder = 'asc',
      } = req.query as Record<string, string>;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = Math.min(parseInt(limit), 100);

      const where: any = {
        companyId,
        ...(search && {
          OR: [
            { name: { contains: search } },
            { productCode: { contains: search } },
            { sku: { contains: search } },
            { barcode: { contains: search } },
            { hsnCode: { contains: search } },
          ],
        }),
        ...(categoryId && { categoryId }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      };

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: { select: { id: true, name: true } },
            brand: { select: { id: true, name: true } },
            unit: { select: { id: true, name: true, abbreviation: true } },
            stockBalances: {
              include: { warehouse: { select: { id: true, name: true } } },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take,
        }),
        prisma.product.count({ where }),
      ]);

      // Add total stock to each product
      const productsWithStock = products.map((p) => ({
        ...p,
        // Convert paise to rupees for frontend
        purchasePrice: TaxService.paiseToRupees(p.purchasePrice),
        sellingPrice: TaxService.paiseToRupees(p.sellingPrice),
        mrp: TaxService.paiseToRupees(p.mrp),
        wholesalePrice: TaxService.paiseToRupees(p.wholesalePrice),
        totalStock: p.stockBalances.reduce((sum, sb) => sum + sb.quantity, 0),
      }));

      // Apply stock filters
      let filtered = productsWithStock;
      if (lowStock === 'true') {
        filtered = filtered.filter((p) => p.totalStock > 0 && p.totalStock <= p.minStock);
      }
      if (outOfStock === 'true') {
        filtered = filtered.filter((p) => p.totalStock <= 0);
      }

      res.json({
        success: true,
        data: filtered,
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

      const product = await prisma.product.findFirst({
        where: { id, companyId },
        include: {
          category: true,
          brand: true,
          unit: true,
          stockBalances: {
            include: { warehouse: true },
          },
          stockTransactions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { warehouse: { select: { name: true } } },
          },
        },
      });

      if (!product) throw new AppError('Product not found.', 404);

      res.json({
        success: true,
        data: {
          ...product,
          purchasePrice: TaxService.paiseToRupees(product.purchasePrice),
          sellingPrice: TaxService.paiseToRupees(product.sellingPrice),
          mrp: TaxService.paiseToRupees(product.mrp),
          wholesalePrice: TaxService.paiseToRupees(product.wholesalePrice),
          totalStock: product.stockBalances.reduce((sum, sb) => sum + sb.quantity, 0),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const data = productSchema.parse(req.body);

      // Validate subscription product limits
      const productCount = await prisma.product.count({ where: { companyId } });
      const subscription = await prisma.subscription.findFirst({
        where: { userId: req.user!.id, status: { in: ['active', 'trial'] } },
        include: { plan: true },
        orderBy: { expiresAt: 'desc' },
      });
      const maxProducts = subscription?.plan?.maxProducts ?? 100;
      if (productCount >= maxProducts) {
        throw new AppError(
          `Your plan allows up to ${maxProducts} products. Please upgrade to add more.`,
          403
        );
      }

      // Check duplicate codes
      if (data.productCode) {
        const existing = await prisma.product.findFirst({
          where: { companyId, productCode: data.productCode },
        });
        if (existing) throw new AppError('A product with this code already exists.', 409);
      }

      if (data.barcode) {
        const existing = await prisma.product.findFirst({
          where: { companyId, barcode: data.barcode },
        });
        if (existing) throw new AppError('A product with this barcode already exists.', 409);
      }

      // Get default warehouse if not specified
      let warehouseId = data.warehouseId;
      if (!warehouseId) {
        const defaultWarehouse = await prisma.warehouse.findFirst({
          where: { companyId, isDefault: true },
        });
        warehouseId = defaultWarehouse?.id;
      }

      const product = await prisma.$transaction(async (tx) => {
        const p = await tx.product.create({
          data: {
            companyId,
            name: data.name,
            description: data.description ?? null,
            productCode: data.productCode || null,
            sku: data.sku || null,
            barcode: data.barcode || null,
            hsnCode: data.hsnCode || null,
            isService: data.isService,
            categoryId: data.categoryId || null,
            brandId: data.brandId || null,
            unitId: data.unitId || null,
            purchasePrice: TaxService.rupeesToPaise(data.purchasePrice),
            sellingPrice: TaxService.rupeesToPaise(data.sellingPrice),
            mrp: TaxService.rupeesToPaise(data.mrp),
            wholesalePrice: TaxService.rupeesToPaise(data.wholesalePrice),
            gstRate: data.gstRate,
            cessRate: data.cessRate,
            taxType: data.taxType,
            openingStock: data.openingStock,
            minStock: data.minStock,
            maxStock: data.maxStock,
            trackInventory: data.trackInventory,
          },
        });

        // Initialize stock balance if opening stock > 0
        if (data.openingStock > 0 && warehouseId) {
          await tx.stockBalance.create({
            data: {
              companyId,
              productId: p.id,
              warehouseId,
              quantity: data.openingStock,
            },
          });

          await tx.stockTransaction.create({
            data: {
              companyId,
              productId: p.id,
              warehouseId,
              transactionType: 'opening',
              quantity: data.openingStock,
              balanceAfter: data.openingStock,
              notes: 'Opening stock entry',
              createdByUserId: req.user!.id,
            },
          });
        }

        return p;
      });

      AuditService.logAsync({
        companyId,
        userId: req.user!.id,
        action: 'create',
        module: 'product',
        recordId: product.id,
        description: `Product created: ${product.name}`,
      });

      res.status(201).json({
        success: true,
        message: 'Product created successfully.',
        data: {
          ...product,
          purchasePrice: data.purchasePrice,
          sellingPrice: data.sellingPrice,
          mrp: data.mrp,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const companyId = req.companyId!;
      const data = productSchema.partial().parse(req.body);

      const existing = await prisma.product.findFirst({ where: { id, companyId } });
      if (!existing) throw new AppError('Product not found.', 404);

      const updated = await prisma.product.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.productCode !== undefined && { productCode: data.productCode || null }),
          ...(data.sku !== undefined && { sku: data.sku || null }),
          ...(data.barcode !== undefined && { barcode: data.barcode || null }),
          ...(data.hsnCode !== undefined && { hsnCode: data.hsnCode || null }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId || null }),
          ...(data.brandId !== undefined && { brandId: data.brandId || null }),
          ...(data.unitId !== undefined && { unitId: data.unitId || null }),
          ...(data.purchasePrice !== undefined && { purchasePrice: TaxService.rupeesToPaise(data.purchasePrice) }),
          ...(data.sellingPrice !== undefined && { sellingPrice: TaxService.rupeesToPaise(data.sellingPrice) }),
          ...(data.mrp !== undefined && { mrp: TaxService.rupeesToPaise(data.mrp) }),
          ...(data.wholesalePrice !== undefined && { wholesalePrice: TaxService.rupeesToPaise(data.wholesalePrice) }),
          ...(data.gstRate && { gstRate: data.gstRate }),
          ...(data.cessRate !== undefined && { cessRate: data.cessRate }),
          ...(data.taxType && { taxType: data.taxType }),
          ...(data.minStock !== undefined && { minStock: data.minStock }),
          ...(data.maxStock !== undefined && { maxStock: data.maxStock }),
          ...(data.trackInventory !== undefined && { trackInventory: data.trackInventory }),
        },
      });

      AuditService.logAsync({
        companyId,
        userId: req.user!.id,
        action: 'update',
        module: 'product',
        recordId: id,
        description: `Product updated: ${updated.name}`,
        previousData: existing,
        newData: data,
      });

      res.json({ success: true, message: 'Product updated.', data: updated });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const companyId = req.companyId!;

      const product = await prisma.product.findFirst({ where: { id, companyId } });
      if (!product) throw new AppError('Product not found.', 404);

      // Soft delete
      await prisma.product.update({ where: { id }, data: { isActive: false } });

      AuditService.logAsync({
        companyId,
        userId: req.user!.id,
        action: 'delete',
        module: 'product',
        recordId: id,
        description: `Product deactivated: ${product.name}`,
      });

      res.json({ success: true, message: 'Product deactivated.' });
    } catch (error) {
      next(error);
    }
  }

  static async searchByBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { barcode } = req.params;
      const companyId = req.companyId!;

      const product = await prisma.product.findFirst({
        where: {
          companyId,
          isActive: true,
          OR: [{ barcode }, { sku: barcode }, { productCode: barcode }],
        },
        include: {
          unit: { select: { name: true, abbreviation: true } },
          stockBalances: true,
        },
      });

      if (!product) throw new AppError('Product not found.', 404);

      res.json({
        success: true,
        data: {
          ...product,
          sellingPrice: TaxService.paiseToRupees(product.sellingPrice),
          purchasePrice: TaxService.paiseToRupees(product.purchasePrice),
          mrp: TaxService.paiseToRupees(product.mrp),
          totalStock: product.stockBalances.reduce((sum, sb) => sum + sb.quantity, 0),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async stockAdjust(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user!.id;
      const { productId, warehouseId, type, quantity, rate, reason, notes } = req.body;

      if (!productId || !warehouseId || !quantity || !reason) {
        throw new AppError('productId, warehouseId, quantity, and reason are required.', 400);
      }

      const product = await prisma.product.findFirst({ where: { id: productId, companyId } });
      if (!product) throw new AppError('Product not found.', 404);

      const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
      if (!warehouse) throw new AppError('Warehouse not found.', 404);

      const result = await prisma.$transaction(async (tx) => {
        let stockBalance = await tx.stockBalance.findFirst({ where: { productId, warehouseId } });
        const beforeQty = stockBalance?.quantity ?? 0;
        const newQty = beforeQty + Number(quantity);

        if (newQty < 0) throw new AppError(`Insufficient stock. Current: ${beforeQty}`, 400);

        if (stockBalance) {
          stockBalance = await tx.stockBalance.update({ where: { id: stockBalance.id }, data: { quantity: newQty } });
        } else {
          stockBalance = await tx.stockBalance.create({ data: { productId, warehouseId, companyId, quantity: newQty } });
        }

        const movement = await tx.stockTransaction.create({
          data: {
            companyId,
            productId,
            warehouseId,
            transactionType: 'adjustment',
            referenceType: 'adjustment',
            referenceId: reason,
            quantity: Number(quantity),
            balanceAfter: newQty,
            notes: notes || reason || null,
            createdByUserId: userId,
          },
        });

        return { movement, beforeQty, afterQty: newQty };
      });

      await AuditService.log({
        companyId,
        userId,
        action: 'UPDATE',
        module: 'PRODUCT',
        recordId: productId,
        description: `Stock adjustment: ${reason} (qty: ${Number(quantity) > 0 ? '+' : ''}${quantity})`,
      });

      res.json({ success: true, message: 'Stock adjusted successfully.', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async stockMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { productId, type, warehouseId, limit = '100', page = '1' } = req.query as Record<string, string>;

      const where: any = { companyId };
      if (productId) where.productId = productId;
      if (type) where.type = type;
      if (warehouseId) where.warehouseId = warehouseId;

      const take = parseInt(limit, 10);
      const skip = (parseInt(page, 10) - 1) * take;

      const [movements, total] = await Promise.all([
        prisma.stockTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
          include: {
            product: { select: { id: true, name: true, productCode: true } },
            warehouse: { select: { id: true, name: true } },
          },
        }),
        prisma.stockTransaction.count({ where }),
      ]);

      res.json({
        success: true,
        data: movements,
        pagination: { total, page: parseInt(page, 10), totalPages: Math.ceil(total / take) },
      });
    } catch (error) {
      next(error);
    }
  }
}
