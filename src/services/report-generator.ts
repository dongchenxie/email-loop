import * as fs from 'fs';
import * as path from 'path';
import { getReportStats } from '../db/database';
import { getDataDir } from '../config';
import { SendReport } from '../types';
import { logger } from './logger';

export class ReportGenerator {
    /**
     * Generate and display report from database
     */
    generateReport(): SendReport {
        const stats = getReportStats();

        const report: SendReport = {
            totalEmails: stats.totalEmails,
            successCount: stats.successCount,
            failureCount: stats.failureCount,
            smtpStats: stats.smtpStats,
            failures: stats.recentFailures,
            generatedAt: new Date(),
        };

        return report;
    }

    /**
     * Display report in console
     */
    displayReport(report: SendReport): void {
        logger.info('\n' + '='.repeat(60));
        logger.info('EMAIL CAMPAIGN REPORT');
        logger.info('='.repeat(60));
        logger.info(`Generated at: ${report.generatedAt.toISOString()}\n`);

        // Summary
        logger.info('SUMMARY');
        logger.info('-'.repeat(40));
        logger.info(`Total Emails Attempted: ${report.totalEmails}`);
        logger.info(`Successful: ${report.successCount} (${this.percentage(report.successCount, report.totalEmails)}%)`);
        logger.info(`Failed: ${report.failureCount} (${this.percentage(report.failureCount, report.totalEmails)}%)\n`);

        // SMTP Stats
        if (report.smtpStats.length > 0) {
            logger.info('SMTP ACCOUNT STATISTICS');
            logger.info('-'.repeat(40));
            for (const smtp of report.smtpStats) {
                logger.info(`${smtp.email}`);
                logger.info(`  Sent: ${smtp.sent} | Failed: ${smtp.failed}`);
            }
            logger.info('');
        }

        // Failures
        if (report.failures.length > 0) {
            logger.info('RECENT FAILURES');
            logger.info('-'.repeat(40));
            for (const failure of report.failures) {
                logger.info(`Customer: ${failure.customerEmail}`);
                logger.info(`  SMTP: ${failure.smtpEmail}`);
                logger.info(`  Error: ${failure.error}\n`);
            }
        }

        logger.info('='.repeat(60) + '\n');
    }

    /**
     * Save report to file
     */
    saveReport(report: SendReport): string {
        const dataDir = getDataDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `report-${timestamp}.json`;
        const filePath = path.join(dataDir, filename);

        fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
        logger.info(`Report saved to: ${filePath}`);

        return filePath;
    }

    private percentage(part: number, total: number): string {
        if (total === 0) return '0.0';
        return ((part / total) * 100).toFixed(1);
    }
}
