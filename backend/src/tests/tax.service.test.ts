/**
 * TaxService Unit Tests
 * Tests the core GST calculation engine for accuracy.
 * Run: cd backend && npx ts-node -e "import('./src/tests/tax.service.test').then(m => m.runTests())"
 */

import { TaxService } from '../services/tax.service';

interface TestCase {
  name: string;
  fn: () => void;
}

let passed = 0;
let failed = 0;

function assertEqual(actual: number, expected: number, label: string, tolerance = 1) {
  if (Math.abs(actual - expected) <= tolerance) {
    console.log(`  âœ… ${label}: ${actual} â‰ˆ ${expected}`);
    passed++;
  } else {
    console.error(`  âŒ ${label}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

function describe(name: string, fn: () => void) {
  console.log(`\nðŸ“¦ ${name}`);
  fn();
}

function test(name: string, fn: () => void) {
  try {
    fn();
  } catch (e: any) {
    console.error(`  âŒ ${name}: THREW ${e.message}`);
    failed++;
  }
}

// â”€â”€â”€ Test Suite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('GST Exclusive Tax â€” Intra-State (CGST + SGST)', () => {
  test('Simple 18% GST on 1000 taxable value', () => {
    const result = TaxService.calculate([
      {
        description: 'Test Item',
        quantity: "1",
        rate: 100000,        // â‚¹1000 in paise
        discountPercent: '0',
        gstRate: '18',
        cessRate: '0',
        taxType: 'exclusive',
      },
    ], { isInterState: false });

    // Taxable: 1000 â†’ CGST: 90, SGST: 90, Total: 1180
    assertEqual(result.taxableAmount, 100000, 'taxableAmount (paise)');
    assertEqual(result.cgstAmount, 9000, 'CGST 9% = 90');
    assertEqual(result.sgstAmount, 9000, 'SGST 9% = 90');
    assertEqual(result.igstAmount, 0, 'IGST = 0 for intra-state');
    assertEqual(result.grandTotal, 118000, 'Grand Total = 1180');
  });

  test('5% GST on â‚¹500', () => {
    const result = TaxService.calculate([{
      description: 'Food Item', quantity: "1", rate: 50000,
      discountPercent: '0', gstRate: '5', cessRate: '0', taxType: 'exclusive',
    }], { isInterState: false });

    assertEqual(result.taxableAmount, 50000, 'taxable');
    assertEqual(result.cgstAmount, 1250, 'CGST 2.5%');
    assertEqual(result.sgstAmount, 1250, 'SGST 2.5%');
    assertEqual(result.grandTotal, 52500, 'grand total');
  });
});

describe('GST Exclusive â€” Inter-State (IGST only)', () => {
  test('18% IGST on â‚¹1000', () => {
    const result = TaxService.calculate([{
      description: 'Item', quantity: "1", rate: 100000,
      discountPercent: '0', gstRate: '18', cessRate: '0', taxType: 'exclusive',
    }], { isInterState: true });

    assertEqual(result.igstAmount, 18000, 'IGST 18%');
    assertEqual(result.cgstAmount, 0, 'CGST = 0');
    assertEqual(result.sgstAmount, 0, 'SGST = 0');
    assertEqual(result.grandTotal, 118000, 'grand total');
  });
});

describe('Line Item Discount', () => {
  test('10% discount on â‚¹1000 item, 18% GST', () => {
    const result = TaxService.calculate([{
      description: 'Discounted Item', quantity: "1", rate: 100000,
      discountPercent: '10', gstRate: '18', cessRate: '0', taxType: 'exclusive',
    }], { isInterState: false });

    // Taxable after 10% disc: 900
    assertEqual(result.taxableAmount, 90000, 'taxable after discount');
    assertEqual(result.cgstAmount, 8100, 'CGST 9% on 900');
    assertEqual(result.sgstAmount, 8100, 'SGST 9% on 900');
    assertEqual(result.grandTotal, 106200, 'grand total = 1062');
    assertEqual(result.lineDiscountTotal, 10000, 'line discount = 100');
  });
});

describe('Multiple Items', () => {
  test('2 items with different GST rates', () => {
    const result = TaxService.calculate([
      { description: 'Item A', quantity: "2", rate: 50000, discountPercent: '0', gstRate: '18', cessRate: '0', taxType: 'exclusive' },
      { description: 'Item B', quantity: "3", rate: 20000, discountPercent: '0', gstRate: '5',  cessRate: '0', taxType: 'exclusive' },
    ], { isInterState: false });

    // Item A: 2*500 = 1000 taxable, 18% = 180 (90 CGST + 90 SGST)
    // Item B: 3*200 = 600 taxable, 5% = 30 (15 CGST + 15 SGST)
    assertEqual(result.taxableAmount, 160000, 'total taxable = 1600');
    assertEqual(result.cgstAmount, 10500, 'total CGST = 105');
    assertEqual(result.sgstAmount, 10500, 'total SGST = 105');
    assertEqual(result.grandTotal, 181000, 'grand total = 1810');
  });
});

describe('Invoice Level Discount', () => {
  test('5% invoice discount on â‚¹1000 item before tax', () => {
    const result = TaxService.calculate([{
      description: 'Item', quantity: "1", rate: 100000,
      discountPercent: '0', gstRate: '18', cessRate: '0', taxType: 'exclusive',
    }], { isInterState: false, invoiceDiscountPercent: '5' });

    // Taxable after 5% inv disc: 950, GST 18%: 171
    assertEqual(result.taxableAmount, 95000, 'taxable after inv discount');
    assertEqual(result.cgstAmount, 8550, 'CGST');
    assertEqual(result.sgstAmount, 8550, 'SGST');
    assertEqual(result.grandTotal, 112100, 'grand total');
  });
});

describe('GST Inclusive Tax', () => {
  test('â‚¹118 inclusive price with 18% GST', () => {
    const result = TaxService.calculate([{
      description: 'Inclusive Item', quantity: "1", rate: 11800,  // â‚¹118 in paise
      discountPercent: '0', gstRate: '18', cessRate: '0', taxType: 'inclusive',
    }], { isInterState: false });

    // Taxable = 11800 * 100/118 = 10000 paise = â‚¹100
    assertEqual(result.taxableAmount, 10000, 'extracted taxable = â‚¹100');
    assertEqual(result.cgstAmount, 900, 'CGST 9% = 9');
    assertEqual(result.sgstAmount, 900, 'SGST 9% = 9');
  });
});

describe('Cess Calculation', () => {
  test('28% GST + 5% Cess on â‚¹1000', () => {
    const result = TaxService.calculate([{
      description: 'Luxury Item', quantity: "1", rate: 100000,
      discountPercent: '0', gstRate: '28', cessRate: '5', taxType: 'exclusive',
    }], { isInterState: false });

    assertEqual(result.taxableAmount, 100000, 'taxable');
    assertEqual(result.cgstAmount, 14000, 'CGST 14%');
    assertEqual(result.sgstAmount, 14000, 'SGST 14%');
    assertEqual(result.cessAmount, 5000, 'Cess 5%');
    assertEqual(result.grandTotal, 133000, 'grand total = 1330');
  });
});

describe('Zero GST', () => {
  test('0% GST (exempt goods)', () => {
    const result = TaxService.calculate([{
      description: 'Exempt Item', quantity: "5", rate: 20000,
      discountPercent: '0', gstRate: '0', cessRate: '0', taxType: 'exclusive',
    }], { isInterState: false });

    assertEqual(result.taxableAmount, 100000, 'taxable = 1000');
    assertEqual(result.totalTax, 0, 'total tax = 0');
    assertEqual(result.grandTotal, 100000, 'grand total = 1000');
  });
});

describe('Amount in Words', () => {
  test('â‚¹1,234.56 in words', () => {
    const words = TaxService.amountToWords(123456);
    const contains = words.toLowerCase().includes('one thousand') || words.toLowerCase().includes('twelve hundred');
    if (contains) {
      console.log(`  âœ… amountToWords: "${words}"`);
      passed++;
    } else {
      console.error(`  âŒ amountToWords unexpected: "${words}"`);
      failed++;
    }
  });

  test('â‚¹0 in words', () => {
    const words = TaxService.amountToWords(0);
    const isZero = words.toLowerCase().includes('zero');
    if (isZero) { console.log(`  âœ… zero: "${words}"`); passed++; }
    else { console.error(`  âŒ zero unexpected: "${words}"`); failed++; }
  });
});

describe('Quantity Variations', () => {
  test('Fractional quantity 2.5 units at â‚¹200 each, 12% GST', () => {
    const result = TaxService.calculate([{
      description: 'By Weight', quantity: "2.5", rate: 20000,
      discountPercent: '0', gstRate: '12', cessRate: '0', taxType: 'exclusive',
    }], { isInterState: false });

    // Taxable: 2.5 * 200 = 500, GST 12% = 60
    assertEqual(result.taxableAmount, 50000, 'taxable');
    assertEqual(result.totalTax, 6000, 'total tax');
    assertEqual(result.grandTotal, 56000, 'grand total = 560');
  });
});

// â”€â”€â”€ Report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log(`\n${'â•'.repeat(50)}`);
console.log(`ðŸ“Š Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed === 0) {
  console.log('ðŸŽ‰ All tests PASSED! GST engine is accurate.');
} else {
  console.log(`âš ï¸  ${failed} test(s) FAILED. Please review the GST calculations.`);
  process.exit(1);
}

export async function runTests() {
  // Already executed at module load
}

