/**
 * Excel Export Utility
 * Uses ExcelJS for browser-side generation (no server needed).
 * Handles: Invoices, Customers, Products, GST Reports.
 */

import * as ExcelJS from 'exceljs';

const BRAND_COLOR = '1A56DB';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLOR } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
const ALT_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F4FF' } };

function autoWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let max = 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 4, 50);
  });
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'medium', color: { argb: '0D47A1' } } };
  });
  row.height = 24;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function rupee(paise: number) {
  return paise / 100;
}

// ─── Export Invoices ───────────────────────────────────
export async function exportInvoices(invoices: any[], filename = 'Invoices.xlsx') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CloudGST Pro';
  wb.created = new Date();

  const ws = wb.addWorksheet('Invoices');

  ws.addRow(['CloudGST Pro — Invoice Export', '', '', '', '', '', '', '', '', `Exported: ${new Date().toLocaleDateString('en-IN')}`]);
  ws.mergeCells(1, 1, 1, 10);
  ws.getRow(1).getCell(1).font = { bold: true, size: 14, color: { argb: BRAND_COLOR } };
  ws.addRow([]);

  const headers = ['Invoice No.', 'Date', 'Customer', 'GSTIN', 'Taxable Amt', 'CGST', 'SGST', 'IGST', 'Round Off', 'Grand Total', 'Paid', 'Balance Due', 'Status', 'Payment Method'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  invoices.forEach((inv, idx) => {
    const row = ws.addRow([
      inv.invoiceNumber,
      new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
      inv.customer?.name || inv.customerName || 'Walk-in',
      inv.customer?.gstin || '',
      rupee(inv.taxableAmount),
      rupee(inv.cgstAmount),
      rupee(inv.sgstAmount),
      rupee(inv.igstAmount),
      rupee(inv.roundOff ?? 0),
      rupee(inv.grandTotal),
      rupee(inv.amountPaid),
      rupee(inv.balanceDue),
      inv.status,
      inv.paymentMethod,
    ]);
    if (idx % 2 === 0) row.eachCell((cell) => { cell.fill = ALT_FILL; });
    // Format number cells
    for (let c = 5; c <= 12; c++) {
      row.getCell(c).numFmt = '₹#,##0.00';
    }
  });

  autoWidth(ws);
  ws.getColumn(2).numFmt = 'DD-MM-YYYY';

  // Totals row
  const totals = invoices.reduce((acc, inv) => {
    acc.taxable += inv.taxableAmount;
    acc.cgst += inv.cgstAmount;
    acc.sgst += inv.sgstAmount;
    acc.igst += inv.igstAmount;
    acc.total += inv.grandTotal;
    acc.paid += inv.amountPaid;
    acc.balance += inv.balanceDue;
    return acc;
  }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, paid: 0, balance: 0 });

  ws.addRow([]);
  const totalRow = ws.addRow(['', 'TOTAL', `${invoices.length} invoices`, '', rupee(totals.taxable), rupee(totals.cgst), rupee(totals.sgst), rupee(totals.igst), '', rupee(totals.total), rupee(totals.paid), rupee(totals.balance)]);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } }; });
  for (let c = 5; c <= 12; c++) totalRow.getCell(c).numFmt = '₹#,##0.00';

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ─── Export Products ───────────────────────────────────
export async function exportProducts(products: any[], filename = 'Products.xlsx') {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Products');

  ws.addRow(['CloudGST Pro — Product Catalog', '', '', '', '', '', '', '', `Exported: ${new Date().toLocaleDateString('en-IN')}`]);
  ws.mergeCells(1, 1, 1, 9);
  ws.getRow(1).getCell(1).font = { bold: true, size: 14, color: { argb: BRAND_COLOR } };
  ws.addRow([]);

  const headers = ['Product Code', 'Product Name', 'Category', 'Brand', 'HSN Code', 'GST Rate %', 'Purchase Price', 'Selling Price', 'MRP', 'Unit', 'Current Stock', 'Min Stock', 'Status'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  products.forEach((p, idx) => {
    const row = ws.addRow([
      p.productCode || '', p.name, p.category?.name || '', p.brand?.name || '',
      p.hsnCode || '', parseFloat(p.gstRate || '0'),
      rupee(p.purchasePrice), rupee(p.sellingPrice), rupee(p.mrp ?? p.sellingPrice),
      p.unit?.abbreviation || '',
      p.totalStock ?? 0, p.minStock ?? 0,
      p.isActive ? 'Active' : 'Inactive',
    ]);
    if (idx % 2 === 0) row.eachCell((cell) => { cell.fill = ALT_FILL; });
    row.getCell(7).numFmt = '₹#,##0.00';
    row.getCell(8).numFmt = '₹#,##0.00';
    row.getCell(9).numFmt = '₹#,##0.00';
  });

  autoWidth(ws);
  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ─── Export Customers ──────────────────────────────────
export async function exportCustomers(customers: any[], filename = 'Customers.xlsx') {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Customers');

  ws.addRow(['CloudGST Pro — Customer List', '', '', '', '', '', `Exported: ${new Date().toLocaleDateString('en-IN')}`]);
  ws.mergeCells(1, 1, 1, 7);
  ws.getRow(1).getCell(1).font = { bold: true, size: 14, color: { argb: BRAND_COLOR } };
  ws.addRow([]);

  const headers = ['Customer Name', 'Phone', 'Email', 'GSTIN', 'Customer Type', 'City', 'State', 'Credit Limit', 'Outstanding', 'Status'];
  styleHeaderRow(ws.addRow(headers));

  customers.forEach((c, idx) => {
    const row = ws.addRow([
      c.name, c.phone || '', c.email || '', c.gstin || '',
      c.customerType || 'b2c', c.city || '', c.state || '',
      rupee(c.creditLimit ?? 0), rupee(c.outstandingBalance ?? 0),
      c.isActive ? 'Active' : 'Inactive',
    ]);
    if (idx % 2 === 0) row.eachCell((cell) => { cell.fill = ALT_FILL; });
    row.getCell(8).numFmt = '₹#,##0.00';
    row.getCell(9).numFmt = '₹#,##0.00';
  });

  autoWidth(ws);
  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ─── Export GST Report ────────────────────────────────
export async function exportGSTReport(data: { summary: any; hsnItems: any[] }, period: string, filename = 'GST_Report.xlsx') {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Summary
  const ws1 = wb.addWorksheet('GSTR-3B Summary');
  ws1.addRow([`GST Summary — ${period}`, '', '', `Generated: ${new Date().toLocaleDateString('en-IN')}`]);
  ws1.getRow(1).font = { bold: true, size: 14, color: { argb: BRAND_COLOR } };
  ws1.addRow([]);
  styleHeaderRow(ws1.addRow(['Particulars', 'Amount (₹)']));
  const summaryRows = [
    ['Total Taxable Sales', rupee(data.summary?.taxableAmount ?? 0)],
    ['CGST Output', rupee(data.summary?.cgst ?? 0)],
    ['SGST Output', rupee(data.summary?.sgst ?? 0)],
    ['IGST Output', rupee(data.summary?.igst ?? 0)],
    ['Cess', rupee(data.summary?.cess ?? 0)],
    ['Input Tax Credit (ITC)', rupee(data.summary?.inputCredit ?? 0)],
    ['Net GST Payable', rupee((data.summary?.cgst ?? 0) + (data.summary?.sgst ?? 0) + (data.summary?.igst ?? 0) - (data.summary?.inputCredit ?? 0))],
  ];
  summaryRows.forEach(([label, val]) => {
    const row = ws1.addRow([label, val]);
    row.getCell(2).numFmt = '₹#,##0.00';
  });
  autoWidth(ws1);

  // Sheet 2: HSN Summary
  const ws2 = wb.addWorksheet('HSN Summary');
  ws2.addRow([`HSN/SAC Summary — ${period}`]);
  ws2.getRow(1).font = { bold: true, size: 14, color: { argb: BRAND_COLOR } };
  ws2.addRow([]);
  styleHeaderRow(ws2.addRow(['HSN Code', 'Description', 'UOM', 'Total Qty', 'Taxable Value', 'GST Rate', 'IGST', 'CGST', 'SGST', 'Total Tax']));
  data.hsnItems.forEach((h, idx) => {
    const row = ws2.addRow([h.hsnCode || '', h.description, h.uom || 'PCS', h.totalQty, rupee(h.taxableAmount), `${h.gstRate}%`, rupee(h.igst), rupee(h.cgst), rupee(h.sgst), rupee(h.igst + h.cgst + h.sgst)]);
    if (idx % 2 === 0) row.eachCell((cell) => { cell.fill = ALT_FILL; });
    for (let c = 5; c <= 10; c++) row.getCell(c).numFmt = '₹#,##0.00';
  });
  autoWidth(ws2);

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}
