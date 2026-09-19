import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

export interface AuditEntry {
  companyId?: string;
  userId?: string;
  action: string;
  module: string;
  recordId?: string;
  recordType?: string;
  description?: string;
  previousData?: object;
  newData?: object;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * AUDIT LOG SERVICE
 * Records every important action. Fire-and-forget — never throws errors
 * that would disrupt the main operation.
 */
export class AuditService {
  static async log(entry: AuditEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          companyId: entry.companyId ?? null,
          userId: entry.userId ?? null,
          action: entry.action,
          module: entry.module,
          recordId: entry.recordId ?? null,
          recordType: entry.recordType ?? null,
          description: entry.description ?? null,
          previousData: entry.previousData ? JSON.stringify(entry.previousData) : null,
          newData: entry.newData ? JSON.stringify(entry.newData) : null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (error) {
      // Audit logging must never break main operations
      logger.error('Failed to write audit log:', error);
    }
  }

  /**
   * Log in background — even faster for non-critical audit events
   */
  static logAsync(entry: AuditEntry): void {
    setImmediate(() => AuditService.log(entry));
  }
}
