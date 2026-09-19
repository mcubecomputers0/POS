import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { authenticate, requireCompany } from '../middleware/auth.middleware';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate, requireCompany);

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  templateType: z.string().default('custom'),
  isDefault: z.boolean().default(false),
  config: z.record(z.any()).default({}),
});

// GET /api/v1/templates - list all templates for company
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const templates = await prisma.invoiceTemplate.findMany({
      where: { companyId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    const parsed = templates.map((t) => ({
      ...t,
      config: typeof t.config === 'string' ? JSON.parse(t.config || '{}') : t.config,
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/templates - create new template
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const data = templateSchema.parse(req.body);

    if (data.isDefault) {
      await prisma.invoiceTemplate.updateMany({
        where: { companyId },
        data: { isDefault: false },
      });
    }

    const template = await prisma.invoiceTemplate.create({
      data: {
        companyId,
        name: data.name,
        templateType: data.templateType,
        isDefault: data.isDefault,
        config: JSON.stringify(data.config || {}),
      },
    });

    if (data.isDefault) {
      await prisma.companySetting.upsert({
        where: { companyId },
        update: { defaultInvoiceTemplateId: template.id },
        create: { companyId, defaultInvoiceTemplateId: template.id },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: {
        ...template,
        config: JSON.parse(template.config || '{}'),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/templates/:id - get template by id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;

    const template = await prisma.invoiceTemplate.findFirst({
      where: { id, companyId },
    });

    if (!template) throw new AppError('Template not found', 404);

    res.json({
      success: true,
      data: {
        ...template,
        config: JSON.parse(template.config || '{}'),
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/templates/:id - update template
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;
    const data = templateSchema.partial().parse(req.body);

    const existing = await prisma.invoiceTemplate.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new AppError('Template not found', 404);

    if (data.isDefault) {
      await prisma.invoiceTemplate.updateMany({
        where: { companyId, id: { not: id } },
        data: { isDefault: false },
      });
      await prisma.companySetting.upsert({
        where: { companyId },
        update: { defaultInvoiceTemplateId: id },
        create: { companyId, defaultInvoiceTemplateId: id },
      });
    }

    const updated = await prisma.invoiceTemplate.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.templateType && { templateType: data.templateType }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.config && { config: JSON.stringify(data.config) }),
      },
    });

    res.json({
      success: true,
      message: 'Template updated successfully',
      data: {
        ...updated,
        config: JSON.parse(updated.config || '{}'),
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/templates/:id - delete template
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;

    const existing = await prisma.invoiceTemplate.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new AppError('Template not found', 404);

    await prisma.invoiceTemplate.delete({ where: { id } });

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/templates/:id/set-default - set as default
router.post('/:id/set-default', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;

    const existing = await prisma.invoiceTemplate.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new AppError('Template not found', 404);

    await prisma.invoiceTemplate.updateMany({
      where: { companyId },
      data: { isDefault: false },
    });

    const updated = await prisma.invoiceTemplate.update({
      where: { id },
      data: { isDefault: true },
    });

    await prisma.companySetting.upsert({
      where: { companyId },
      update: { defaultInvoiceTemplateId: id },
      create: { companyId, defaultInvoiceTemplateId: id },
    });

    res.json({
      success: true,
      message: 'Template set as default',
      data: {
        ...updated,
        config: JSON.parse(updated.config || '{}'),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
