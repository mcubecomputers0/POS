import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error details (never expose to client)
  if (!(error instanceof AppError) || error.statusCode >= 500) {
    logger.error(`[${req.method}] ${req.path} — ${error.message}`, {
      stack: error.stack,
      body: req.body,
    });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const errors = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(422).json({
      success: false,
      message: 'Validation failed. Please check your input.',
      errors,
    });
    return;
  }

  // Handle Prisma errors — translate to user-friendly messages
  if (error.constructor.name.startsWith('Prisma')) {
    const prismaError = error as any;
    
    if (prismaError.code === 'P2002') {
      // Unique constraint violation
      const fields = prismaError.meta?.target as string[] | undefined;
      const fieldName = fields?.[0] ?? 'field';
      res.status(409).json({
        success: false,
        message: `A record with this ${fieldName} already exists.`,
      });
      return;
    }

    if (prismaError.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Record not found.',
      });
      return;
    }

    if (prismaError.code === 'P2003') {
      res.status(409).json({
        success: false,
        message: 'Cannot complete this action because related records exist.',
      });
      return;
    }

    // Generic Prisma error — don't expose SQL
    res.status(500).json({
      success: false,
      message: 'A database error occurred. Please try again.',
    });
    return;
  }

  // Handle operational errors (AppError)
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  // Unhandled error — generic 500
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again or contact support.',
  });
};
