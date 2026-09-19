import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/client';
import { AppError } from './errorHandler';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      companyId?: string;
      companyUser?: {
        id: string;
        roleId: string;
        isOwner: boolean;
      };
    }
  }
}

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  iat: number;
  exp: number;
}

/**
 * Verify JWT access token and attach user to request
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError('Server configuration error.', 500);
    }

    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, secret) as JWTPayload;
    } catch (err) {
      if ((err as any).name === 'TokenExpiredError') {
        throw new AppError('Session expired. Please log in again.', 401);
      }
      throw new AppError('Invalid authentication token.', 401);
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, isSuperAdmin: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('Account not found or deactivated.', 401);
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Verify company membership and attach companyId + role to request.
 * Company ID comes from X-Company-Id header.
 * MUST be called after authenticate().
 */
export const requireCompany = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    if (!companyId) {
      throw new AppError('Company ID required. Please select a company.', 400);
    }

    // Super admin can access any company
    if (req.user?.isSuperAdmin) {
      // Verify company exists
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, isActive: true },
      });
      if (!company || !company.isActive) {
        throw new AppError('Company not found or inactive.', 404);
      }
      req.companyId = companyId;
      next();
      return;
    }

    // Regular user — must be a member of the company
    const companyUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: req.user!.id,
        },
      },
      select: {
        id: true,
        roleId: true,
        isOwner: true,
        isActive: true,
        company: { select: { isActive: true } },
      },
    });

    if (!companyUser || !companyUser.isActive) {
      throw new AppError('You do not have access to this company.', 403);
    }

    if (!companyUser.company.isActive) {
      throw new AppError('This company account is inactive. Please contact support.', 403);
    }

    req.companyId = companyId;
    req.companyUser = {
      id: companyUser.id,
      roleId: companyUser.roleId,
      isOwner: companyUser.isOwner,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require super admin role
 */
export const requireSuperAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isSuperAdmin) {
    next(new AppError('Super admin access required.', 403));
    return;
  }
  next();
};

/**
 * Check if user has a specific permission for the current company.
 * Usage: requirePermission('invoices', 'delete')
 */
export const requirePermission = (module: string, action: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Super admin and company owner bypass all permission checks
      if (req.user?.isSuperAdmin || req.companyUser?.isOwner) {
        next();
        return;
      }

      if (!req.companyUser?.roleId) {
        throw new AppError('Permission denied.', 403);
      }

      const permission = await prisma.rolePermission.findFirst({
        where: {
          roleId: req.companyUser.roleId,
          granted: true,
          permission: { module, action },
        },
      });

      if (!permission) {
        throw new AppError(
          `You don't have permission to ${action} ${module}. Contact your administrator.`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
