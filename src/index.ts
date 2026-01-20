#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { initDatabase, closeDatabase, recordEmailSent } from './db/database';
import { loadConfig } from './config';
import { parseCSV } from './services/csv-parser';
import { SmtpPool } from './services/smtp-pool';
import { EmailGenerator } from './services/email-generator';
import { EmailSender } from './services/email-sender';
import { ReportGenerator } from './services/report-generator';
import { logger } from './services/logger';

const program = new Command();

program
    .name('email-loop')
    .description('Email marketing automation CLI with SMTP load balancing and AI content generation')
    .version('1.0.0');

// Initialize logger
const LOG_DIR = path.join(process.cwd(), 'logs');

// Send command
program
    .command('send')
    .description('Send marketing emails to customers from CSV')
    .requiredOption('-c, --csv <path>', 'Path to customer CSV file')
    .option('--dry-run', 'Generate emails without sending')
    .option('--delay <ms>', 'Delay between emails in ms', '2000')
    .action(async (options) => {
        try {
            logger.init(LOG_DIR);
            logger.info('Initializing application...');
            logger.info(`Arguments: csv=${options.csv}, dry-run=${options.dryRun}, delay=${options.delay}`);

            initDatabase();

            const config = loadConfig();
            logger.info('Configuration loaded');

            const customers = parseCSV(options.csv);
            logger.info(`Loaded ${customers.length} customers from CSV`);

            const smtpPool = new SmtpPool();
            const emailGenerator = new EmailGenerator(config);
            const emailSender = new EmailSender();
            const reportGenerator = new ReportGenerator();

            const delay = parseInt(options.delay, 10) || config.email.rateLimit.delayBetweenEmails;

            logger.info(`Starting email campaign${options.dryRun ? ' (DRY RUN)' : ''}...`);

            for (let i = 0; i < customers.length; i++) {
                const customer = customers[i];
                logger.info(`[${i + 1}/${customers.length}] Processing ${customer.email} (${customer.website})`);

                try {
                    // Get SMTP with least sends (load balancing)
                    const smtp = smtpPool.getNextSmtp();
                    logger.info(`Selected SMTP: ${smtp.email} (sent: ${smtp.sentCount})`);

                    // Generate email content
                    const email = await emailGenerator.generateEmail(customer);

                    if (options.dryRun) {
                        logger.info('--- DRY RUN: Email Preview ---');
                        logger.info(`Subject: ${email.subject}`);
                        logger.info(`Body:\n${email.body}`);
                        logger.info('--- End Preview ---');
                    } else {
                        // Send email
                        const result = await emailSender.sendEmail(smtp, customer, email);

                        // Record to database
                        recordEmailSent(result);

                        // Update SMTP send count on success
                        if (result.status === 'success') {
                            smtpPool.recordSend(smtp.email);
                        }
                    }
                } catch (error) {
                    logger.error(`Error processing ${customer.email}:`, error);
                }

                // Delay between emails (except for last one)
                if (i < customers.length - 1 && !options.dryRun) {
                    // Add random jitter (±20%) to delay
                    const jitter = delay * 0.2;
                    const hostDelay = delay + (Math.random() * jitter * 2 - jitter);

                    logger.info(`Waiting ${Math.round(hostDelay)}ms before next email (base: ${delay}ms)...`);
                    await new Promise(resolve => setTimeout(resolve, hostDelay));
                }
            }

            logger.info('Campaign complete!');

            if (!options.dryRun) {
                // Generate and display report
                const report = reportGenerator.generateReport();
                reportGenerator.displayReport(report);
                const reportPath = reportGenerator.saveReport(report);
                logger.info(`Report saved to ${reportPath}`);
            }
        } catch (error) {
            // logger might not be initialized if error happens very early, but we try
            if ((logger as any).logFileStream) {
                logger.error('Fatal execution error:', error);
            } else {
                console.error('Fatal execution error:', error);
            }
            process.exit(1);
        } finally {
            closeDatabase();
            logger.close();
        }
    });

// Report command
program
    .command('report')
    .description('Display email campaign report')
    .option('--save', 'Save report to file')
    .action((options) => {
        try {
            // We don't always need full file logging for report command, but let's init console logs
            // or optionally init file logging. For "generate log each run", yes let's init.
            logger.init(LOG_DIR);

            initDatabase();

            const reportGenerator = new ReportGenerator();
            const report = reportGenerator.generateReport();

            reportGenerator.displayReport(report);

            if (options.save) {
                const path = reportGenerator.saveReport(report);
                logger.info(`Report saved to ${path}`);
            }
        } catch (error) {
            logger.error('Error:', error);
            process.exit(1);
        } finally {
            closeDatabase();
            logger.close();
        }
    });

// Test SMTP command
program
    .command('test-smtp')
    .description('Test all SMTP connections')
    .action(async () => {
        try {
            logger.init(LOG_DIR);
            logger.info('Starting SMTP connection test...');

            initDatabase();

            const smtpPool = new SmtpPool();
            const emailSender = new EmailSender();
            const accounts = smtpPool.getAllAccountsWithStats();

            logger.info(`Testing ${accounts.length} SMTP accounts...`);

            for (const account of accounts) {
                // process.stdout.write(`Testing ${account.email}... `); // Keep for immediate feedback?
                // Let's rely on logger which logs to console
                logger.info(`Testing connection for ${account.email}...`);

                const success = await emailSender.testConnection(account);
                if (success) {
                    logger.info(`✓ Connected: ${account.email}`);
                } else {
                    logger.error(`✗ Failed: ${account.email}`);
                }
            }

            logger.info('SMTP test complete.');
        } catch (error) {
            logger.error('Error:', error);
            process.exit(1);
        } finally {
            closeDatabase();
            logger.close();
        }
    });

// Stats command
program
    .command('stats')
    .description('Show SMTP account statistics')
    .action(() => {
        try {
            logger.init(LOG_DIR);

            initDatabase();

            const smtpPool = new SmtpPool();
            const accounts = smtpPool.getAllAccountsWithStats();

            logger.info('SMTP Account Statistics:');

            for (const account of accounts) {
                logger.info(`${account.email}: ${account.sentCount} emails sent`);
            }

            const total = accounts.reduce((sum, acc) => sum + acc.sentCount, 0);
            logger.info(`Total: ${total} emails`);
        } catch (error) {
            logger.error('Error:', error);
            process.exit(1);
        } finally {
            closeDatabase();
            logger.close();
        }
    });

program.parse();
