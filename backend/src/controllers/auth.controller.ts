import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from '../services/audit.service';

const BCRYPT_ROUNDS = 12;

// â”€â”€â”€ Validation Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').toLowerCase(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number').optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-z])/, 'Must contain a lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Must contain an uppercase letter')
    .regex(/(?=.*\d)/, 'Must contain a number'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-z])/, 'Must contain a lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Must contain an uppercase letter')
    .regex(/(?=.*\d)/, 'Must contain a number'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-z])/, 'Must contain a lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Must contain an uppercase letter')
    .regex(/(?=.*\d)/, 'Must contain a number'),
});

// â”€â”€â”€ Token Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function generateAccessToken(user: {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
}): string {
  return jwt.sign(
    { userId: user.id, email: user.email, name: user.name, isSuperAdmin: user.isSuperAdmin },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as any
  );
}

function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as any
  );
}

// â”€â”€â”€ Controller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = registerSchema.parse(req.body);

      // Check for existing user
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { email: data.email },
            ...(data.phone ? [{ phone: data.phone }] : []),
          ],
        },
      });

      if (existing) {
        throw new AppError('An account with this email or phone already exists.', 409);
      }

      const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

      // Get free plan
      const freePlan = await prisma.subscriptionPlan.findFirst({
        where: { name: 'free' },
        orderBy: { priceMonthly: 'asc' },
      });

      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            phone: data.phone ?? null,
            passwordHash,
          },
        });

        // Create trial subscription
        if (freePlan) {
          const now = new Date();
          const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
          await tx.subscription.create({
            data: {
              userId: newUser.id,
              planId: freePlan.id,
              status: 'trial',
              startsAt: now,
              expiresAt: trialEnd,
              trialEndsAt: trialEnd,
            },
          });
        }

        return newUser;
      });

      AuditService.logAsync({
        userId: user.id,
        action: 'register',
        module: 'auth',
        description: `New user registered: ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user.id);

      // Store refresh token
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          deviceInfo: req.headers['user-agent']?.substring(0, 200) ?? null,
          ipAddress: req.ip ?? null,
          expiresAt,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Account created successfully. Welcome to CloudGST Pro!',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            isSuperAdmin: user.isSuperAdmin,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!user) {
        throw new AppError('Invalid email or password.', 401);
      }

      if (!user.isActive) {
        throw new AppError('Your account has been deactivated. Please contact support.', 403);
      }

      const passwordMatch = await bcrypt.compare(data.password, user.passwordHash);
      if (!passwordMatch) {
        AuditService.logAsync({
          userId: user.id,
          action: 'login_failed',
          module: 'auth',
          description: `Failed login attempt for: ${user.email}`,
          ipAddress: req.ip,
        });
        throw new AppError('Invalid email or password.', 401);
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      AuditService.logAsync({
        userId: user.id,
        action: 'login',
        module: 'auth',
        description: `User logged in: ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user.id);

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          deviceInfo: req.headers['user-agent']?.substring(0, 200) ?? null,
          ipAddress: req.ip ?? null,
          expiresAt,
        },
      });

      // Get user's companies
      const companies = await prisma.companyUser.findMany({
        where: { userId: user.id, isActive: true },
        include: {
          company: {
            select: { id: true, name: true, logoPath: true, signaturePath: true, gstin: true, isActive: true },
          },
          role: { select: { id: true, name: true, displayName: true } },
        },
      });

      res.json({
        success: true,
        message: 'Login successful.',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            profilePhoto: user.profilePhoto,
            isSuperAdmin: user.isSuperAdmin,
          },
          companies: companies.map((cu) => ({
            companyId: cu.companyId,
            companyName: cu.company.name,
            logoPath: cu.company.logoPath,
            signaturePath: cu.company.signaturePath,
            gstin: cu.company.gstin,
            isOwner: cu.isOwner,
            role: cu.role,
          })),
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);

      let payload: { userId: string };
      try {
        payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      } catch {
        throw new AppError('Invalid or expired refresh token. Please log in again.', 401);
      }

      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
        throw new AppError('Session expired. Please log in again.', 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true, isSuperAdmin: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw new AppError('Account not found or deactivated.', 401);
      }

      // Rotate refresh token
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      });

      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user.id);

      await prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: user.id,
          deviceInfo: storedToken.deviceInfo,
          ipAddress: req.ip ?? null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await prisma.refreshToken.updateMany({
          where: { token: refreshToken },
          data: { isRevoked: true },
        });
      }

      AuditService.logAsync({
        userId: req.user?.id,
        action: 'logout',
        module: 'auth',
        ipAddress: req.ip,
      });

      res.json({ success: true, message: 'Logged out successfully.' });
    } catch (error) {
      next(error);
    }
  }

  static async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await prisma.refreshToken.updateMany({
        where: { userId: req.user!.id },
        data: { isRevoked: true },
      });

      AuditService.logAsync({
        userId: req.user!.id,
        action: 'logout_all',
        module: 'auth',
        description: 'Logged out from all devices',
        ipAddress: req.ip,
      });

      res.json({ success: true, message: 'Logged out from all devices.' });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = changePasswordSchema.parse(req.body);

      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user) throw new AppError('User not found.', 404);

      const match = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!match) throw new AppError('Current password is incorrect.', 400);

      const newHash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });

      // Revoke all refresh tokens (force re-login on other devices)
      await prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });

      AuditService.logAsync({
        userId: user.id,
        action: 'change_password',
        module: 'auth',
        ipAddress: req.ip,
      });

      res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profilePhoto: true,
          isSuperAdmin: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      if (!user) throw new AppError('User not found.', 404);

      const companies = await prisma.companyUser.findMany({
        where: { userId: user.id, isActive: true },
        include: {
          company: {
            select: { id: true, name: true, logoPath: true, signaturePath: true, gstin: true, isActive: true },
          },
          role: { select: { id: true, name: true, displayName: true } },
        },
      });

      res.json({
        success: true,
        data: {
          user,
          companies: companies.map((cu) => ({
            companyId: cu.companyId,
            companyName: cu.company.name,
            logoPath: cu.company.logoPath,
            signaturePath: cu.company.signaturePath,
            gstin: cu.company.gstin,
            isOwner: cu.isOwner,
            role: cu.role,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessions = await prisma.refreshToken.findMany({
        where: { userId: req.user!.id, isRevoked: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          deviceInfo: true,
          ipAddress: true,
          createdAt: true,
          expiresAt: true,
        },
      });

      res.json({ success: true, data: sessions });
    } catch (error) {
      next(error);
    }
  }

  static async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await prisma.refreshToken.findFirst({
        where: { id: sessionId, userId: req.user!.id },
      });

      if (!session) throw new AppError('Session not found.', 404);

      await prisma.refreshToken.update({
        where: { id: sessionId },
        data: { isRevoked: true },
      });

      res.json({ success: true, message: 'Session revoked.' });
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: any, res: any, next: any): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error('Not authenticated');
      const { name, phone, profilePhoto } = req.body;

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name && { name }),
          ...(phone !== undefined && { phone }),
          ...(profilePhoto !== undefined && { profilePhoto }),
        },
        select: { id: true, name: true, email: true, phone: true, profilePhoto: true, isSuperAdmin: true },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}
