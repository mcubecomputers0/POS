import { prisma } from '../prisma/client';

export type DocType =
  | 'invoice'
  | 'quotation'
  | 'purchase'
  | 'sales_return'
  | 'purchase_return'
  | 'credit_note'
  | 'debit_note'
  | 'payment'
  | 'expense';

/**
 * DOCUMENT NUMBERING SERVICE
 * Generates sequential, non-duplicate document numbers per company + financial year + type.
 * Uses atomic DB updates to prevent race conditions under concurrent load.
 */
export class NumberingService {
  /**
   * Get the next document number and atomically increment the counter.
   * Must be called within the same transaction that creates the document.
   */
  static async getNextNumber(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    companyId: string,
    docType: DocType,
    financialYearId?: string
  ): Promise<string> {
    // Find or create series
    let series = await tx.invoiceSeries.findUnique({
      where: {
        companyId_financialYearId_docType: {
          companyId,
          financialYearId: financialYearId ?? '',
          docType,
        },
      },
    });

    if (!series) {
      // Get defaults from company settings
      const settings = await tx.companySetting.findUnique({
        where: { companyId },
      });

      const prefixMap: Record<DocType, string> = {
        invoice: settings?.invoicePrefix ?? 'INV',
        quotation: settings?.quotationPrefix ?? 'QUO',
        purchase: settings?.purchasePrefix ?? 'PUR',
        sales_return: settings?.salesReturnPrefix ?? 'SRN',
        purchase_return: settings?.purchaseReturnPrefix ?? 'PRN',
        credit_note: settings?.creditNotePrefix ?? 'CN',
        debit_note: settings?.debitNotePrefix ?? 'DN',
        payment: 'PAY',
        expense: 'EXP',
      };

      const startNumber = docType === 'invoice' ? (settings?.invoiceStartNumber ?? 1) : 1;

      series = await tx.invoiceSeries.create({
        data: {
          companyId,
          financialYearId: financialYearId ?? null,
          docType,
          prefix: prefixMap[docType],
          currentNumber: startNumber - 1,
          padLength: 6,
        },
      });
    }

    // Atomically increment
    const updated = await tx.invoiceSeries.update({
      where: { id: series.id },
      data: { currentNumber: { increment: 1 } },
    });

    const padded = String(updated.currentNumber).padStart(updated.padLength, '0');
    return `${updated.prefix}-${padded}`;
  }

  /**
   * Preview next number without incrementing (for display purposes only)
   */
  static async peekNextNumber(
    companyId: string,
    docType: DocType,
    financialYearId?: string
  ): Promise<string> {
    const series = await prisma.invoiceSeries.findUnique({
      where: {
        companyId_financialYearId_docType: {
          companyId,
          financialYearId: financialYearId ?? '',
          docType,
        },
      },
    });

    if (!series) {
      const settings = await prisma.companySetting.findUnique({ where: { companyId } });
      return `INV-000001`;
    }

    const nextNum = series.currentNumber + 1;
    const padded = String(nextNum).padStart(series.padLength, '0');
    return `${series.prefix}-${padded}`;
  }
}
