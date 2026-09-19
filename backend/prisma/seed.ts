import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CloudGST Pro database...');

  // ─── Subscription Plans ──────────────────────────────────────────────
  console.log('Creating subscription plans...');
  const plans = await Promise.all([
    prisma.subscriptionPlan.upsert({
      where: { name: 'free' },
      create: {
        name: 'free', displayName: 'Free / Trial',
        description: 'Perfect for trying CloudGST Pro',
        priceMonthly: 0, priceYearly: 0,
        maxCompanies: 1, maxProducts: 100,
        maxInvoicesPerMonth: 50, maxUsers: 2, maxWarehouses: 1,
        hasGstReports: false, hasAdvancedReports: false, hasImportExport: false,
        sortOrder: 0,
      },
      update: {},
    }),
    prisma.subscriptionPlan.upsert({
      where: { name: 'basic' },
      create: {
        name: 'basic', displayName: 'Basic',
        description: 'For small businesses',
        priceMonthly: 49900, priceYearly: 499900,  // ₹499/mo, ₹4999/yr
        maxCompanies: 2, maxProducts: 1000,
        maxInvoicesPerMonth: 500, maxUsers: 5, maxWarehouses: 2,
        hasGstReports: true, hasAdvancedReports: false, hasImportExport: true,
        hasBarcodeScanning: true, sortOrder: 1,
      },
      update: {},
    }),
    prisma.subscriptionPlan.upsert({
      where: { name: 'professional' },
      create: {
        name: 'professional', displayName: 'Professional',
        description: 'For growing businesses',
        priceMonthly: 99900, priceYearly: 999900,  // ₹999/mo, ₹9999/yr
        maxCompanies: 5, maxProducts: 10000,
        maxInvoicesPerMonth: 5000, maxUsers: 20, maxWarehouses: 5,
        hasGstReports: true, hasAdvancedReports: true, hasImportExport: true,
        hasBarcodeScanning: true, hasApiAccess: true, sortOrder: 2,
      },
      update: {},
    }),
    prisma.subscriptionPlan.upsert({
      where: { name: 'enterprise' },
      create: {
        name: 'enterprise', displayName: 'Enterprise',
        description: 'Unlimited for large businesses',
        priceMonthly: 299900, priceYearly: 2999900,  // ₹2999/mo, ₹29999/yr
        maxCompanies: 999, maxProducts: 999999,
        maxInvoicesPerMonth: 999999, maxUsers: 999, maxWarehouses: 999,
        hasGstReports: true, hasAdvancedReports: true, hasImportExport: true,
        hasBarcodeScanning: true, hasApiAccess: true, sortOrder: 3,
      },
      update: {},
    }),
  ]);
  console.log(`✅ Created ${plans.length} subscription plans`);

  // ─── Permissions ─────────────────────────────────────────────────────
  console.log('Creating permissions...');
  const modules = [
    'invoices', 'quotations', 'purchases', 'sales_returns', 'purchase_returns',
    'products', 'categories', 'customers', 'suppliers', 'warehouses',
    'payments', 'expenses', 'reports', 'staff', 'roles',
    'settings', 'audit_logs', 'notifications', 'company',
  ];
  const actions = ['view', 'add', 'edit', 'delete', 'export', 'print', 'approve', 'cancel'];

  for (const module of modules) {
    for (const action of actions) {
      await prisma.permission.upsert({
        where: { module_action: { module, action } },
        create: {
          module, action,
          displayName: `${action.charAt(0).toUpperCase() + action.slice(1)} ${module.replace('_', ' ')}`,
        },
        update: {},
      });
    }
  }
  console.log('✅ Permissions created');

  // ─── System Roles ────────────────────────────────────────────────────
  console.log('Creating system roles...');

  const allPermissions = await prisma.permission.findMany();

  // Helper to upsert system roles (companyId = null)
  async function upsertSystemRole(name: string, displayName: string, description: string) {
    const existing = await prisma.role.findFirst({ where: { name, companyId: null, isSystem: true } });
    if (existing) return existing;
    return prisma.role.create({ data: { name, displayName, isSystem: true, description } });
  }

  // Company Owner role (all permissions)
  const ownerRole = await upsertSystemRole('company_owner', 'Company Owner', 'Full access to company');

  // Billing Staff role
  const billingPerms = ['invoices', 'quotations', 'customers', 'products', 'payments'].flatMap((m) =>
    ['view', 'add', 'edit', 'print'].map((a) => ({ module: m, action: a }))
  );

  const billingRole = await upsertSystemRole('billing_staff', 'Billing Staff', 'POS and billing access');

  // Add billing permissions
  for (const perm of billingPerms) {
    const permission = allPermissions.find((p) => p.module === perm.module && p.action === perm.action);
    if (permission) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: billingRole.id, permissionId: permission.id } },
        create: { roleId: billingRole.id, permissionId: permission.id, granted: true },
        update: {},
      });
    }
  }

  // Inventory Staff role
  const inventoryRole = await upsertSystemRole('inventory_staff', 'Inventory Staff', 'Inventory management access');

  // Accountant role
  const accountantRole = await upsertSystemRole('accountant', 'Accountant', 'Financial and GST access');

  console.log('✅ System roles created');

  // ─── Super Admin ─────────────────────────────────────────────────────
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@cloudgstpro.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

  console.log(`Creating super admin: ${superAdminEmail}`);
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    create: {
      name: 'Super Admin',
      email: superAdminEmail,
      passwordHash,
      isSuperAdmin: true,
      isEmailVerified: true,
    },
    update: { isSuperAdmin: true },
  });
  console.log('✅ Super admin created');

  // ─── Demo User & Company ─────────────────────────────────────────────
  console.log('Creating demo data...');

  const demoPassword = await bcrypt.hash('Demo@1234', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@cloudgstpro.com' },
    create: {
      name: 'Demo User',
      email: 'demo@cloudgstpro.com',
      phone: '9876543210',
      passwordHash: demoPassword,
      isEmailVerified: true,
    },
    update: {},
  });

  // Trial subscription for demo user
  const freePlan = plans[0];
  const existingSubscription = await prisma.subscription.findFirst({ where: { userId: demoUser.id } });
  if (!existingSubscription) {
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.subscription.create({
      data: {
        userId: demoUser.id, planId: freePlan.id, status: 'trial',
        startsAt: new Date(), expiresAt: trialEnd, trialEndsAt: trialEnd,
      },
    });
  }

  // Demo Company
  await prisma.company.deleteMany({ where: { name: 'Demo Sports Store' } }).catch(() => {});
  let demoCompany = await prisma.company.findFirst({ where: { name: 'Demo Sports Store' } });
  if (!demoCompany) {
    const tx = prisma;
      const company = await tx.company.create({
        data: {
          name: 'Demo Sports Store',
          legalName: 'Demo Sports Store Private Limited',
          businessType: 'retail',
          gstin: '29AADCD1234F1Z5',
          pan: 'AADCD1234F',
          gstRegistrationType: 'regular',
          addressLine1: '123, MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          stateCode: '29',
          pinCode: '560001',
          email: 'info@demosports.com',
          phone: '9876543210',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
        },
      });

      await tx.companySetting.create({ data: { companyId: company.id, invoicePrefix: 'INV', upiId: 'demosports@upi', upiName: 'Demo Sports Store' } });
      await tx.companyUser.create({ data: { companyId: company.id, userId: demoUser.id, roleId: ownerRole.id, isOwner: true } });

      const now = new Date();
      const fyStart = now.getMonth() >= 3 ? new Date(now.getFullYear(), 3, 1) : new Date(now.getFullYear() - 1, 3, 1);
      const fyEnd = new Date(fyStart.getFullYear() + 1, 2, 31);
      const fyName = `${fyStart.getFullYear()}-${String(fyStart.getFullYear() + 1).slice(2)}`;

      await tx.financialYear.create({ data: { companyId: company.id, name: fyName, startDate: fyStart, endDate: fyEnd, isCurrent: true } });

      const warehouse = await tx.warehouse.create({ data: { companyId: company.id, name: 'Main Store', isDefault: true } });

      await tx.bankAccount.create({
        data: {
          companyId: company.id, bankName: 'State Bank of India',
          accountName: 'Demo Sports Store', accountNumber: '12345678901',
          ifscCode: 'SBIN0001234', branchName: 'MG Road, Bengaluru',
          upiId: 'demosports@sbi', isPrimary: true,
        },
      });

      // Default Expense Categories
      const expCats = ['Rent', 'Electricity', 'Salaries', 'Transport', 'Internet', 'Marketing', 'Other'];
      await tx.expenseCategory.createMany({ data: expCats.map((name) => ({ companyId: company.id, name })) });

      // Units
      const units = [
        { name: 'Pieces', abbreviation: 'PCS' }, { name: 'Pairs', abbreviation: 'PR' },
        { name: 'Sets', abbreviation: 'SET' }, { name: 'Dozens', abbreviation: 'DOZ' },
      ];
      await tx.unit.createMany({ data: units.map((u) => ({ companyId: company.id, ...u })) });

      // Categories
      const cricket = await tx.category.create({ data: { companyId: company.id, name: 'Cricket', description: 'Cricket equipment' } });
      const football = await tx.category.create({ data: { companyId: company.id, name: 'Football', description: 'Football equipment' } });

      const batSubcat = await tx.category.create({ data: { companyId: company.id, name: 'Cricket Bats', parentId: cricket.id } });
      const ballSubcat = await tx.category.create({ data: { companyId: company.id, name: 'Cricket Balls', parentId: cricket.id } });

      const pcsUnit = await tx.unit.findFirst({ where: { companyId: company.id, abbreviation: 'PCS' } });

      // Products
      const products = [
        { name: 'SS Ton Player Edition Cricket Bat', productCode: 'CRIC-BAT-001', barcode: '8901030123456', hsnCode: '9506', categoryId: batSubcat.id, purchasePrice: 250000, sellingPrice: 350000, mrp: 399900, gstRate: '12', openingStock: 15 },
        { name: 'SG Test Cricket Bat', productCode: 'CRIC-BAT-002', barcode: '8901030234567', hsnCode: '9506', categoryId: batSubcat.id, purchasePrice: 180000, sellingPrice: 250000, mrp: 299900, gstRate: '12', openingStock: 20 },
        { name: 'Kookaburra Cricket Ball (Red)', productCode: 'CRIC-BALL-001', barcode: '8901030345678', hsnCode: '9506', categoryId: ballSubcat.id, purchasePrice: 45000, sellingPrice: 65000, mrp: 75000, gstRate: '12', openingStock: 50 },
        { name: 'SG Practice Cricket Ball (Pack of 6)', productCode: 'CRIC-BALL-002', hsnCode: '9506', categoryId: ballSubcat.id, purchasePrice: 90000, sellingPrice: 130000, mrp: 149900, gstRate: '12', openingStock: 30 },
        { name: 'Nike Strike Football', productCode: 'FOOT-BALL-001', barcode: '8901030456789', hsnCode: '9506', categoryId: football.id, purchasePrice: 150000, sellingPrice: 220000, mrp: 249900, gstRate: '18', openingStock: 25 },
        { name: 'Adidas Predator Football Boots (Size 8)', productCode: 'FOOT-BOOT-001', hsnCode: '6404', categoryId: football.id, purchasePrice: 380000, sellingPrice: 550000, mrp: 649900, gstRate: '18', openingStock: 10 },
      ];

      for (const p of products) {
        const product = await tx.product.create({
          data: {
            companyId: company.id, unitId: pcsUnit?.id ?? null,
            name: p.name, productCode: p.productCode,
            barcode: p.barcode ?? null, hsnCode: p.hsnCode,
            categoryId: p.categoryId, purchasePrice: p.purchasePrice,
            sellingPrice: p.sellingPrice, mrp: p.mrp, gstRate: p.gstRate,
            openingStock: p.openingStock, minStock: 5,
          },
        });

        await tx.stockBalance.create({ data: { companyId: company.id, productId: product.id, warehouseId: warehouse.id, quantity: p.openingStock } });
        await tx.stockTransaction.create({ data: { companyId: company.id, productId: product.id, warehouseId: warehouse.id, transactionType: 'opening', quantity: p.openingStock, balanceAfter: p.openingStock, notes: 'Opening stock' } });
      }

      // Customers
      const customers = [
        { name: 'Rajesh Kumar', phone: '9876543001', email: 'rajesh@example.com', city: 'Bengaluru', state: 'Karnataka', stateCode: '29', customerType: 'B2C' },
        { name: 'Priya Sports Shop', phone: '9876543002', email: 'priya@priyasports.com', gstin: '29AABCP1234F1ZZ', city: 'Mysuru', state: 'Karnataka', stateCode: '29', customerType: 'B2B' },
        { name: 'Chennai Sports Club', phone: '9876543003', gstin: '33AABCC9876D1Z1', city: 'Chennai', state: 'Tamil Nadu', stateCode: '33', customerType: 'B2B' },
      ];

      for (const c of customers) {
        await tx.customer.create({ data: { companyId: company.id, ...c, gstin: (c as any).gstin ?? null } });
      }

      // Suppliers
      await tx.supplier.create({
        data: {
          companyId: company.id, name: 'Sports Wholesale India',
          phone: '8765432001', gstin: '29AABCS5678E1Z3',
          city: 'Bengaluru', state: 'Karnataka', stateCode: '29',
        },
      });

      // Sample expense
      const expCat = await tx.expenseCategory.findFirst({ where: { companyId: company.id, name: 'Rent' } });
      await tx.expense.create({
        data: {
          companyId: company.id, categoryId: expCat?.id,
          description: 'Monthly shop rent - MG Road',
          amount: 2500000, gstAmount: 0, totalAmount: 2500000,
          expenseDate: new Date(), paymentMethod: 'bank', status: 'confirmed',
        },
      });

      // Low stock notification
      await tx.notification.create({
        data: {
          companyId: company.id, type: 'low_stock',
          title: 'Low Stock Alert', message: 'Adidas Predator Football Boots is running low (10 remaining)',
        },
      });

      demoCompany = company;
    console.log('✅ Demo company created with products, customers, suppliers, and sample data');
  } else {
    console.log('✅ Demo company already exists, skipping');
  }

  console.log('\n🎉 Seeding complete!');
  console.log('\n📋 Login credentials:');
  console.log(`   Super Admin: ${process.env.SUPER_ADMIN_EMAIL || 'superadmin@cloudgstpro.com'} / ${process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123'}`);
  console.log('   Demo User:   demo@cloudgstpro.com / Demo@1234');
  console.log('\nDash to http://localhost:5173 after starting the frontend!\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
