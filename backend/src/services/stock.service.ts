import { prisma } from '../prisma/client';
import Decimal from 'decimal.js';

export type StockTransactionType =
  | 'opening'
  | 'purchase'
  | 'purchase_return'
  | 'sale'
  | 'sales_return'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'damaged'
  | 'expired'
  | 'free';

export interface StockMovement {
  productId: string;
  warehouseId: string;
  quantity: number;         // positive = in, negative = out
  transactionType: StockTransactionType;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdByUserId?: string;
}

/**
 * CENTRALIZED INVENTORY SERVICE
 * All stock movements must go through this service.
 * All operations use Prisma transactions for atomicity.
 */
export class StockService {
  /**
   * Process multiple stock movements atomically within an existing transaction.
   * Use this when called from within another transaction (e.g., invoice creation).
   */
  static async processMovements(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    companyId: string,
    movements: StockMovement[]
  ): Promise<void> {
    for (const movement of movements) {
      const { productId, warehouseId, quantity, transactionType, referenceType, referenceId, notes, createdByUserId } = movement;

      // Upsert stock balance
      const existing = await tx.stockBalance.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
      });

      const currentBalance = existing?.quantity ?? 0;
      const newBalance = currentBalance + quantity;

      await tx.stockBalance.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        create: {
          companyId,
          productId,
          warehouseId,
          quantity: newBalance,
        },
        update: {
          quantity: newBalance,
        },
      });

      // Record transaction log
      await tx.stockTransaction.create({
        data: {
          companyId,
          productId,
          warehouseId,
          transactionType,
          referenceType: referenceType ?? null,
          referenceId: referenceId ?? null,
          quantity,
          balanceAfter: newBalance,
          notes: notes ?? null,
          createdByUserId: createdByUserId ?? null,
        },
      });
    }
  }

  /**
   * Get current stock for a product in a warehouse
   */
  static async getStock(productId: string, warehouseId: string): Promise<number> {
    const balance = await prisma.stockBalance.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    return balance?.quantity ?? 0;
  }

  /**
   * Get total stock across all warehouses for a product
   */
  static async getTotalStock(companyId: string, productId: string): Promise<number> {
    const result = await prisma.stockBalance.aggregate({
      where: { companyId, productId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  /**
   * Check if sufficient stock is available for a sale
   */
  static async checkSufficientStock(
    movements: Array<{ productId: string; warehouseId: string; quantity: number }>
  ): Promise<Array<{ productId: string; warehouseId: string; available: number; required: number; sufficient: boolean }>> {
    const results = await Promise.all(
      movements.map(async ({ productId, warehouseId, quantity }) => {
        const available = await StockService.getStock(productId, warehouseId);
        return {
          productId,
          warehouseId,
          available,
          required: Math.abs(quantity),
          sufficient: available >= Math.abs(quantity),
        };
      })
    );
    return results;
  }

  /**
   * Transfer stock between warehouses atomically
   */
  static async transfer(
    companyId: string,
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    notes?: string,
    userId?: string
  ): Promise<void> {
    if (quantity <= 0) throw new Error('Transfer quantity must be positive');

    await prisma.$transaction(async (tx) => {
      await StockService.processMovements(tx, companyId, [
        {
          productId,
          warehouseId: fromWarehouseId,
          quantity: -quantity,
          transactionType: 'transfer_out',
          notes,
          createdByUserId: userId,
        },
        {
          productId,
          warehouseId: toWarehouseId,
          quantity: quantity,
          transactionType: 'transfer_in',
          notes,
          createdByUserId: userId,
        },
      ]);
    });
  }
}
