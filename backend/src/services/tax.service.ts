import Decimal from 'decimal.js';

// Configure Decimal for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface TaxableItem {
  description: string;
  hsnCode?: string;
  quantity: string;          // string to avoid float issues
  rate: number;              // paise per unit
  discountPercent?: string;  // "0" to "100"
  discountAmount?: number;   // paise (if fixed discount)
  gstRate: string;           // "0", "5", "12", "18", "28"
  cessRate?: string;         // default "0"
  taxType?: 'inclusive' | 'exclusive';
}

export interface TaxConfig {
  isInterState: boolean;     // true = IGST, false = CGST+SGST
  invoiceDiscountPercent?: string;
  roundOff?: boolean;
}

export interface ItemTaxResult {
  quantity: string;
  rate: number;
  discountPercent: string;
  discountAmount: number;
  taxableAmount: number;
  gstRate: string;
  cessRate: string;
  cgstPercent: string;
  sgstPercent: string;
  igstPercent: string;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalAmount: number;
}

export interface TaxResult {
  items: ItemTaxResult[];
  subtotal: number;           // sum of (qty * rate) before any discount
  lineDiscountTotal: number;  // total line-level discounts
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

/**
 * CENTRALIZED GST TAX ENGINE
 * All tax calculations must go through this service.
 * Never calculate GST in individual controllers or components.
 */
export class TaxService {
  /**
   * Calculate tax for a complete invoice/purchase
   */
  static calculate(items: TaxableItem[], config: TaxConfig): TaxResult {
    const { isInterState, invoiceDiscountPercent = '0', roundOff = true } = config;

    let subtotal = new Decimal(0);
    let lineDiscountTotal = new Decimal(0);
    let taxableTotal = new Decimal(0);
    let cgstTotal = new Decimal(0);
    let sgstTotal = new Decimal(0);
    let igstTotal = new Decimal(0);
    let cessTotal = new Decimal(0);

    const calculatedItems: ItemTaxResult[] = items.map((item) => {
      const qty = new Decimal(item.quantity || '0');
      const rate = new Decimal(item.rate || 0);
      const taxType = item.taxType || 'exclusive';
      const gstRate = new Decimal(item.gstRate || '0');
      const cessRate = new Decimal(item.cessRate || '0');
      const discountPercent = new Decimal(item.discountPercent || '0');

      // Gross line amount (before discount)
      const grossAmount = qty.mul(rate);
      subtotal = subtotal.add(grossAmount);

      // Line discount
      let lineDiscount: Decimal;
      if (item.discountAmount !== undefined) {
        lineDiscount = new Decimal(item.discountAmount);
      } else {
        lineDiscount = grossAmount.mul(discountPercent).div(100);
      }
      lineDiscountTotal = lineDiscountTotal.add(lineDiscount);

      const amountAfterDiscount = grossAmount.sub(lineDiscount);

      // For GST-inclusive prices, extract taxable amount
      let taxableAmount: Decimal;
      if (taxType === 'inclusive') {
        const totalTaxRate = gstRate.add(cessRate);
        taxableAmount = amountAfterDiscount.mul(100).div(new Decimal(100).add(totalTaxRate));
      } else {
        taxableAmount = amountAfterDiscount;
      }

      // Split GST
      let cgstAmount = new Decimal(0);
      let sgstAmount = new Decimal(0);
      let igstAmount = new Decimal(0);
      let cessAmount = taxableAmount.mul(cessRate).div(100);

      if (isInterState) {
        igstAmount = taxableAmount.mul(gstRate).div(100);
      } else {
        const halfGst = gstRate.div(2);
        cgstAmount = taxableAmount.mul(halfGst).div(100);
        sgstAmount = taxableAmount.mul(halfGst).div(100);
      }

      const itemTotal = taxableAmount.add(cgstAmount).add(sgstAmount).add(igstAmount).add(cessAmount);

      taxableTotal = taxableTotal.add(taxableAmount);
      cgstTotal = cgstTotal.add(cgstAmount);
      sgstTotal = sgstTotal.add(sgstAmount);
      igstTotal = igstTotal.add(igstAmount);
      cessTotal = cessTotal.add(cessAmount);

      const halfGstRate = gstRate.div(2).toString();

      return {
        quantity: item.quantity,
        rate: item.rate,
        discountPercent: discountPercent.toString(),
        discountAmount: TaxService.toPaise(lineDiscount),
        taxableAmount: TaxService.toPaise(taxableAmount),
        gstRate: gstRate.toString(),
        cessRate: cessRate.toString(),
        cgstPercent: isInterState ? '0' : halfGstRate,
        sgstPercent: isInterState ? '0' : halfGstRate,
        igstPercent: isInterState ? gstRate.toString() : '0',
        cgstAmount: TaxService.toPaise(cgstAmount),
        sgstAmount: TaxService.toPaise(sgstAmount),
        igstAmount: TaxService.toPaise(igstAmount),
        cessAmount: TaxService.toPaise(cessAmount),
        totalAmount: TaxService.toPaise(itemTotal),
      };
    });

    // Invoice-level discount (applied on taxable amount)
    const invoiceDiscPct = new Decimal(invoiceDiscountPercent || '0');
    const invoiceDiscountAmount = taxableTotal.mul(invoiceDiscPct).div(100);
    const taxableAfterInvoiceDisc = taxableTotal.sub(invoiceDiscountAmount);

    // Adjust tax proportionally for invoice discount
    const discountRatio = taxableTotal.isZero()
      ? new Decimal(1)
      : taxableAfterInvoiceDisc.div(taxableTotal);

    const finalCgst = cgstTotal.mul(discountRatio);
    const finalSgst = sgstTotal.mul(discountRatio);
    const finalIgst = igstTotal.mul(discountRatio);
    const finalCess = cessTotal.mul(discountRatio);
    const totalTax = finalCgst.add(finalSgst).add(finalIgst).add(finalCess);

    const rawGrandTotal = taxableAfterInvoiceDisc.add(totalTax);

    // Round off
    let roundOffAmount = new Decimal(0);
    let grandTotal = rawGrandTotal;
    if (roundOff) {
      const rounded = rawGrandTotal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      roundOffAmount = rounded.sub(rawGrandTotal);
      grandTotal = rounded;
    }

    return {
      items: calculatedItems,
      subtotal: TaxService.toPaise(subtotal),
      lineDiscountTotal: TaxService.toPaise(lineDiscountTotal),
      invoiceDiscountAmount: TaxService.toPaise(invoiceDiscountAmount),
      totalDiscountAmount: TaxService.toPaise(lineDiscountTotal.add(invoiceDiscountAmount)),
      taxableAmount: TaxService.toPaise(taxableAfterInvoiceDisc),
      cgstAmount: TaxService.toPaise(finalCgst),
      sgstAmount: TaxService.toPaise(finalSgst),
      igstAmount: TaxService.toPaise(finalIgst),
      cessAmount: TaxService.toPaise(finalCess),
      totalTax: TaxService.toPaise(totalTax),
      roundOff: TaxService.toPaise(roundOffAmount),
      grandTotal: TaxService.toPaise(grandTotal),
    };
  }

  /** Convert Decimal to integer paise (rounds to nearest paisa) */
  static toPaise(value: Decimal): number {
    // Values are already in paise (we work in paise throughout)
    return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  }

  /** Format paise to rupee display string */
  static formatRupee(paise: number): string {
    return (paise / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    });
  }

  /** Convert rupees string to paise integer */
  static rupeesToPaise(rupees: string | number): number {
    return new Decimal(rupees).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  }

  /** Convert paise to rupee number */
  static paiseToRupees(paise: number): number {
    return new Decimal(paise).div(100).toNumber();
  }

  /** Convert amount to words (Indian numbering) */
  static amountToWords(paise: number): string {
    const rupees = Math.floor(paise / 100);
    const paiseVal = paise % 100;

    const words = TaxService.numberToWords(rupees);
    let result = `${words} Rupees`;
    if (paiseVal > 0) {
      result += ` and ${TaxService.numberToWords(paiseVal)} Paise`;
    }
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

  /** Validate GST rate */
  static isValidGstRate(rate: string): boolean {
    return ['0', '0.1', '0.25', '1.5', '3', '5', '12', '18', '28'].includes(rate);
  }
}
