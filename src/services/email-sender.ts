import * as nodemailer from 'nodemailer';
import { SmtpAccountWithStats, Customer, LlmResponse, EmailSendResult } from '../types';
import { logger } from './logger';

export class EmailSender {
    /**
     * Send an email using the specified SMTP account
     */
    /**
     * Send an email using the specified SMTP account
     */
    async sendEmail(
        smtpAccount: SmtpAccountWithStats,
        customer: Customer,
        email: LlmResponse,
        replyTo?: string
    ): Promise<EmailSendResult> {
        const result: EmailSendResult = {
            customer,
            smtpEmail: smtpAccount.email,
            subject: email.subject || '',
            status: 'failed',
            sentAt: new Date(),
        };

        try {
            // Create transporter for Gmail
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false, // Use TLS
                auth: {
                    user: smtpAccount.email,
                    pass: smtpAccount.appPassword,
                },
            });

            // Build email
            const mailOptions: nodemailer.SendMailOptions = {
                from: smtpAccount.email,
                to: customer.email,
                subject: email.subject!,
                text: email.body!,
                html: this.convertToHtml(email.body!),
            };

            if (replyTo) {
                mailOptions.replyTo = replyTo;
            }

            // Send email
            await transporter.sendMail(mailOptions);

            result.status = 'success';
            logger.info(`✓ Email sent to ${customer.email} via ${smtpAccount.email}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errorMessage = errorMessage;
            logger.error(`✗ Failed to send to ${customer.email}: ${errorMessage}`);
        }

        return result;
    }

    /**
     * Test SMTP connection
     */
    async testConnection(smtpAccount: SmtpAccountWithStats): Promise<boolean> {
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: smtpAccount.email,
                    pass: smtpAccount.appPassword,
                },
            });

            await transporter.verify();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Convert plain text to simple HTML
     */
    private convertToHtml(text: string): string {
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const htmlBody = escaped
            .split('\n\n')
            .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
            .join('\n');

        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    p { margin: 0 0 1em 0; }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`;
    }
}
