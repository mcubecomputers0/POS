/**
 * Frontend GST Tax Calculation Utilities
 * Mirrors the backend TaxService for live cart preview.
 * All amounts in paise (int) to avoid IEEE 754 float errors.
 */

export interface TaxableItem {
  description: string;
  quantity: string;
  rate: number;       // paise
  discountPercent?: string;
  gstRate: string;
  cessRate?: string;
  taxType?: 'inclusive' | 'exclusive';
}

export interface TaxConfig {
  isInterState: boolean;
  invoiceDiscountPercent?: string;
  roundOff?: boolean;
}

export interface ItemTaxResult {
  quantity: string;
  rate: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: string;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalAmount: number;
}

export interface TaxResult {
  items: ItemTaxResult[];
  subtotal: number;
  lineDiscountTotal: number;
  invoiceDiscountAmount: number;
  totalDiscountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class TaxService {
  static calculate(items: TaxableItem[], config: TaxConfig): TaxResult {
    const { isInterState, invoiceDiscountPercent = '0', roundOff = true } = config;

    let subtotal = 0;
    let lineDiscountTotal = 0;
    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let cessTotal = 0;

    const calculatedItems: ItemTaxResult[] = items.map((item) => {
      const qty = parseFloat(item.quantity || '0') || 0;
      const rate = item.rate || 0;
      const gstRate = parseFloat(item.gstRate || '0') || 0;
      const cessRate = parseFloat(item.cessRate || '0') || 0;
      const discountPct = parseFloat(item.discountPercent || '0') || 0;
      const taxType = item.taxType || 'exclusive';

      const grossAmount = qty * rate;
      subtotal += grossAmount;

      const lineDiscount = grossAmount * discountPct / 100;
      lineDiscountTotal += lineDiscount;

      const amountAfterDiscount = grossAmount - lineDiscount;

      let taxableAmount: number;
      if (taxType === 'inclusive') {
        const totalTaxRate = gstRate + cessRate;
        taxableAmount = amountAfterDiscount * 100 / (100 + totalTaxRate);
      } else {
        taxableAmount = amountAfterDiscount;
      }

      let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
      const cessAmount = taxableAmount * cessRate / 100;

      if (isInterState) {
        igstAmount = taxableAmount * gstRate / 100;
      } else {
        cgstAmount = taxableAmount * (gstRate / 2) / 100;
        sgstAmount = taxableAmount * (gstRate / 2) / 100;
      }

      const itemTotal = taxableAmount + cgstAmount + sgstAmount + igstAmount + cessAmount;

      taxableTotal += taxableAmount;
      cgstTotal += cgstAmount;
      sgstTotal += sgstAmount;
      igstTotal += igstAmount;
      cessTotal += cessAmount;

      return {
        quantity: item.quantity,
        rate,
        discountAmount: Math.round(lineDiscount),
        taxableAmount: Math.round(taxableAmount),
        gstRate: item.gstRate,
        cgstAmount: Math.round(cgstAmount),
        sgstAmount: Math.round(sgstAmount),
        igstAmount: Math.round(igstAmount),
        cessAmount: Math.round(cessAmount),
        totalAmount: Math.round(itemTotal),
      };
    });

    // Invoice discount
    const invoiceDiscPct = parseFloat(invoiceDiscountPercent || '0') || 0;
    const invoiceDiscountAmount = taxableTotal * invoiceDiscPct / 100;
    const taxableAfterInvoiceDisc = taxableTotal - invoiceDiscountAmount;

    const discountRatio = taxableTotal === 0 ? 1 : taxableAfterInvoiceDisc / taxableTotal;

    const finalCgst = cgstTotal * discountRatio;
    const finalSgst = sgstTotal * discountRatio;
    const finalIgst = igstTotal * discountRatio;
    const finalCess = cessTotal * discountRatio;
    const totalTax = finalCgst + finalSgst + finalIgst + finalCess;

    const rawGrandTotal = taxableAfterInvoiceDisc + totalTax;

    let roundOffAmount = 0;
    let grandTotal = rawGrandTotal;
    if (roundOff) {
      const rounded = Math.round(rawGrandTotal);
      roundOffAmount = rounded - rawGrandTotal;
      grandTotal = rounded;
    }

    return {
      items: calculatedItems,
      subtotal: Math.round(subtotal),
      lineDiscountTotal: Math.round(lineDiscountTotal),
      invoiceDiscountAmount: Math.round(invoiceDiscountAmount),
      totalDiscountAmount: Math.round(lineDiscountTotal + invoiceDiscountAmount),
      taxableAmount: Math.round(taxableAfterInvoiceDisc),
      cgstAmount: Math.round(finalCgst),
      sgstAmount: Math.round(finalSgst),
      igstAmount: Math.round(finalIgst),
      cessAmount: Math.round(finalCess),
      totalTax: Math.round(totalTax),
      roundOff: Math.round(roundOffAmount),
      grandTotal: Math.round(grandTotal),
    };
  }

  static formatRupee(paise: number): string {
    return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  }

  static amountToWords(paise: number): string {
    const rupees = Math.floor(paise / 100);
    const paiseVal = paise % 100;
    const words = TaxService.numberToWords(rupees);
    let result = `${words} Rupees`;
    if (paiseVal > 0) result += ` and ${TaxService.numberToWords(paiseVal)} Paise`;
    return result + ' Only';
  }

  private static ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  private static tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  private static numberToWords(num: number): string {
    if (num === 0) return 'Zero';
    if (num < 20) return TaxService.ones[num];
    if (num < 100) return `${TaxService.tens[Math.floor(num / 10)]}${num % 10 ? ' ' + TaxService.ones[num % 10] : ''}`;
    if (num < 1000) return `${TaxService.ones[Math.floor(num / 100)]} Hundred${num % 100 ? ' ' + TaxService.numberToWords(num % 100) : ''}`;
    if (num < 100000) return `${TaxService.numberToWords(Math.floor(num / 1000))} Thousand${num % 1000 ? ' ' + TaxService.numberToWords(num % 1000) : ''}`;
    if (num < 10000000) return `${TaxService.numberToWords(Math.floor(num / 100000))} Lakh${num % 100000 ? ' ' + TaxService.numberToWords(num % 100000) : ''}`;
    return `${TaxService.numberToWords(Math.floor(num / 10000000))} Crore${num % 10000000 ? ' ' + TaxService.numberToWords(num % 10000000) : ''}`;
  }
}
