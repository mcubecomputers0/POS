import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

const isEmailConfigured =
  !!process.env.SMTP_HOST &&
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS;

const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export class EmailService {
  static async sendEmail(options: EmailOptions): Promise<void> {
    if (!transporter) {
      // Stub: log to console in development
      logger.info(`[EMAIL STUB] To: ${options.to} | Subject: ${options.subject}`);
      logger.debug(`[EMAIL STUB] Body: ${options.html.substring(0, 200)}...`);
      return;
    }

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"CloudGST Pro" <no-reply@cloudgstpro.com>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      });
      logger.info(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error) {
      logger.error(`Failed to send email to ${options.to}:`, error);
      throw new Error('Failed to send email. Please try again later.');
    }
  }

  static async sendInvoice(
    to: string,
    companyName: string,
    invoiceNumber: string,
    pdfBuffer: Buffer
  ): Promise<void> {
    await EmailService.sendEmail({
      to,
      subject: `Invoice ${invoiceNumber} from ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a56db;">Invoice from ${companyName}</h2>
          <p>Dear Customer,</p>
          <p>Please find your invoice <strong>${invoiceNumber}</strong> attached to this email.</p>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Thank you for your business!</p>
          <hr />
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated email from CloudGST Pro. Please do not reply to this email.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `${invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  static async sendPasswordReset(to: string, resetLink: string): Promise<void> {
    await EmailService.sendEmail({
      to,
      subject: 'Reset Your CloudGST Pro Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a56db;">Reset Your Password</h2>
          <p>You requested a password reset. Click the button below to set a new password.</p>
          <p>
            <a href="${resetLink}" 
               style="background: #1a56db; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            This link expires in 1 hour. If you did not request this, please ignore this email.
          </p>
        </div>
      `,
    });
  }
}
