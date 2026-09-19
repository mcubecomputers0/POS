import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from '../services/audit.service';

const createCompanySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters').max(200),
  legalName: z.string().max(200).optional(),
  businessType: z.string().optional(),
  gstin: z.string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format')
    .optional()
    .or(z.literal('')),
  pan: z.string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format')
    .optional()
    .or(z.literal('')),
  cin: z.string().optional(),
  gstRegistrationType: z.enum(['regular', 'composition', 'unregistered', 'sez', 'other']).default('regular'),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().max(2).optional(),
  pinCode: z.string().regex(/^\d{6}$/, 'Invalid PIN code').optional().or(z.literal('')),
  country: z.string().default('India'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  currency: z.string().default('INR'),
  timezone: z.string().default('Asia/Kolkata'),
});

const updateCompanySchema = createCompanySchema.partial().extend({
  logoPath: z.string().nullable().optional(),
  signaturePath: z.string().nullable().optional(),
});

export class CompanyController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companies = await prisma.companyUser.findMany({
        where: { userId: req.user!.id, isActive: true },
        include: {
          company: true,
          role: { select: { id: true, name: true, displayName: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json({
        success: true,
        data: companies.map((cu) => ({
          ...cu.company,
          isOwner: cu.isOwner,
          role: cu.role,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createCompanySchema.parse(req.body);

      // Check subscription plan limits
      const existingCompanies = await prisma.companyUser.count({
        where: { userId: req.user!.id, isActive: true, isOwner: true },
      });

      const subscription = await prisma.subscription.findFirst({
        where: { userId: req.user!.id, status: { in: ['active', 'trial'] } },
        include: { plan: true },
        orderBy: { expiresAt: 'desc' },
      });

      const maxCompanies = subscription?.plan?.maxCompanies ?? 1;
      if (existingCompanies >= maxCompanies) {
        throw new AppError(
          `Your current plan allows up to ${maxCompanies} company(ies). Please upgrade to add more.`,
          403
        );
      }

      // Get or create company owner role
      let ownerRole = await prisma.role.findFirst({
        where: { companyId: null, name: 'company_owner', isSystem: true },
      });

      if (!ownerRole) {
        ownerRole = await prisma.role.create({
          data: {
            name: 'company_owner',
            displayName: 'Company Owner',
            description: 'Full access to company',
            isSystem: true,
          },
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: data.name,
            legalName: data.legalName ?? null,
            businessType: data.businessType ?? null,
            gstin: data.gstin || null,
            pan: data.pan || null,
            cin: data.cin ?? null,
            gstRegistrationType: data.gstRegistrationType,
            addressLine1: data.addressLine1 ?? null,
            addressLine2: data.addressLine2 ?? null,
            city: data.city ?? null,
            state: data.state ?? null,
            stateCode: data.stateCode ?? null,
            pinCode: data.pinCode || null,
            country: data.country,
            email: data.email || null,
            phone: data.phone ?? null,
            website: data.website || null,
            currency: data.currency,
            timezone: data.timezone,
          },
        });

        // Create default settings
        await tx.companySetting.create({
          data: { companyId: company.id },
        });

        // Add owner as company user
        await tx.companyUser.create({
          data: {
            companyId: company.id,
            userId: req.user!.id,
            roleId: ownerRole!.id,
            isOwner: true,
          },
        });

        // Create default financial year (Indian: Apr-Mar)
        const now = new Date();
        const fiscalStart = now.getMonth() >= 3  // April onwards = current FY
          ? new Date(now.getFullYear(), 3, 1)
          : new Date(now.getFullYear() - 1, 3, 1);
        const fiscalEnd = new Date(fiscalStart.getFullYear() + 1, 2, 31);
        const fyName = `${fiscalStart.getFullYear()}-${String(fiscalStart.getFullYear() + 1).slice(2)}`;

        await tx.financialYear.create({
          data: {
            companyId: company.id,
            name: fyName,
            startDate: fiscalStart,
            endDate: fiscalEnd,
            isCurrent: true,
          },
        });

        // Create default warehouse
        await tx.warehouse.create({
          data: {
            companyId: company.id,
            name: 'Main Store',
            isDefault: true,
          },
        });

        // Create default expense categories
        const defaultCategories = [
          'Rent', 'Electricity', 'Salaries', 'Transport', 'Internet',
          'Maintenance', 'Marketing', 'Office Supplies', 'Other',
        ];
        await tx.expenseCategory.createMany({
          data: defaultCategories.map((name) => ({ companyId: company.id, name })),
        });

        // Create default units
        const defaultUnits = [
          { name: 'Pieces', abbreviation: 'PCS' },
          { name: 'Kilograms', abbreviation: 'KG' },
          { name: 'Grams', abbreviation: 'GM' },
          { name: 'Litres', abbreviation: 'LTR' },
          { name: 'Metres', abbreviation: 'MTR' },
          { name: 'Dozen', abbreviation: 'DOZ' },
          { name: 'Box', abbreviation: 'BOX' },
          { name: 'Numbers', abbreviation: 'NOS' },
        ];
        await tx.unit.createMany({
          data: defaultUnits.map((u) => ({ companyId: company.id, ...u })),
        });

        return company;
      });

      AuditService.logAsync({
        companyId: result.id,
        userId: req.user!.id,
        action: 'create',
        module: 'company',
        recordId: result.id,
        description: `Company created: ${result.name}`,
      });

      res.status(201).json({
        success: true,
        message: 'Company created successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Security: ensure user belongs to this company
      const companyUser = await prisma.companyUser.findFirst({
        where: { companyId: id, userId: req.user!.id, isActive: true },
      });

      if (!companyUser && !req.user!.isSuperAdmin) {
        throw new AppError('Company not found.', 404);
      }

      const company = await prisma.company.findUnique({
        where: { id },
        include: {
          settings: true,
          bankAccounts: true,
          financialYears: { orderBy: { startDate: 'desc' } },
        },
      });

      if (!company) throw new AppError('Company not found.', 404);

      res.json({ success: true, data: company });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = updateCompanySchema.parse(req.body);

      // Verify company access
      const company = await prisma.company.findFirst({
        where: { id, companyUsers: { some: { userId: req.user!.id, isOwner: true } } },
      });

      if (!company && !req.user!.isSuperAdmin) {
        throw new AppError('Company not found or insufficient permissions.', 403);
      }

      const updated = await prisma.company.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.legalName !== undefined && { legalName: data.legalName }),
          ...(data.gstin !== undefined && { gstin: data.gstin || null }),
          ...(data.pan !== undefined && { pan: data.pan || null }),
          ...(data.gstRegistrationType && { gstRegistrationType: data.gstRegistrationType }),
          ...(data.addressLine1 !== undefined && { addressLine1: data.addressLine1 }),
          ...(data.city !== undefined && { city: data.city }),
          ...(data.state !== undefined && { state: data.state }),
          ...(data.stateCode !== undefined && { stateCode: data.stateCode }),
          ...(data.pinCode !== undefined && { pinCode: data.pinCode || null }),
          ...(data.email !== undefined && { email: data.email || null }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.website !== undefined && { website: data.website || null }),
          ...(data.logoPath !== undefined && { logoPath: data.logoPath || null }),
          ...(data.signaturePath !== undefined && { signaturePath: data.signaturePath || null }),
        },
      });

      AuditService.logAsync({
        companyId: id,
        userId: req.user!.id,
        action: 'update',
        module: 'company',
        recordId: id,
        description: `Company updated: ${updated.name}`,
        previousData: company!,
        newData: data,
      });

      res.json({ success: true, message: 'Company updated successfully.', data: updated });
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;

      const settings = await prisma.companySetting.upsert({
        where: { companyId },
        create: { companyId, ...req.body },
        update: req.body,
      });

      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;

      const [customers, suppliers, products, invoices] = await Promise.all([
        prisma.customer.count({ where: { companyId, isActive: true } }),
        prisma.supplier.count({ where: { companyId, isActive: true } }),
        prisma.product.count({ where: { companyId, isActive: true } }),
        prisma.invoice.count({ where: { companyId } }),
      ]);

      res.json({
        success: true,
        data: { customers, suppliers, products, invoices },
      });
    } catch (error) {
      next(error);
    }
  }
}
