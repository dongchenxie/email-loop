import * as fs from 'fs';
import { getSmtpFilePath } from '../config';
import { getSmtpSentCount, ensureSmtpAccount, incrementSmtpSentCount } from '../db/database';
import { SmtpAccount, SmtpAccountWithStats } from '../types';
import { logger } from './logger';

export class SmtpPool {
    private accounts: SmtpAccount[] = [];
    private blacklist: Set<string> = new Set(); // Temporarily failed accounts

    constructor() {
        this.loadAccounts();
    }

    private loadAccounts(): void {
        const smtpPath = getSmtpFilePath();

        if (!fs.existsSync(smtpPath)) {
            const error = new Error(`SMTP configuration file not found: ${smtpPath}`);
            logger.error('Failed to load SMTP accounts', error);
            throw error;
        }

        logger.info(`Loading SMTP accounts from ${smtpPath}`);
        const content = fs.readFileSync(smtpPath, 'utf-8');

        try {
            const { parse } = require('csv-parse/sync');

            const records = parse(content, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });

            for (const record of records) {
                const email = record.email || record.Email;
                const password = record.password || record.Password || record.appPassword || record.app_password;

                if (email && password) {
                    const account: SmtpAccount = {
                        email: email.trim(),
                        appPassword: password.trim(),
                    };
                    this.accounts.push(account);
                    ensureSmtpAccount(account.email);
                } else {
                    logger.warn('Skipping invalid SMTP record:', record);
                }
            }
        } catch (error) {
            logger.error('Failed to parse SMTP CSV file', error);
            throw error;
        }

        if (this.accounts.length === 0) {
            const error = new Error('No valid SMTP accounts found in smtp.csv');
            logger.error('SMTP account validation failed', error);
            throw error;
        }

        logger.info(`Loaded ${this.accounts.length} SMTP accounts from ${smtpPath}`);
    }

    /**
     * Get SMTP account with the least sent emails, excluding blacklisted ones
     */
    getNextSmtp(): SmtpAccountWithStats | null {
        const availableAccounts = this.accounts.filter(acc => !this.blacklist.has(acc.email));

        if (availableAccounts.length === 0) {
            logger.error('No available SMTP accounts - all are blacklisted!');
            return null;
        }

        const accountsWithStats: SmtpAccountWithStats[] = availableAccounts.map(acc => ({
            ...acc,
            sentCount: getSmtpSentCount(acc.email),
        }));

        accountsWithStats.sort((a, b) => a.sentCount - b.sentCount);

        return accountsWithStats[0];
    }

    /**
     * Mark SMTP as failed (temporarily blacklist)
     */
    markAsFailed(email: string): void {
        this.blacklist.add(email);
        logger.warn(`SMTP ${email} blacklisted for this session (${this.getAvailableCount()} accounts remaining)`);
    }

    /**
     * Get count of available (non-blacklisted) accounts
     */
    getAvailableCount(): number {
        return this.accounts.length - this.blacklist.size;
    }

    /**
     * Record successful send for an SMTP account
     */
    recordSend(email: string): void {
        incrementSmtpSentCount(email);
    }

    /**
     * Get all accounts for testing
     */
    getAllAccounts(): SmtpAccount[] {
        return [...this.accounts];
    }

    /**
     * Get all accounts with their stats
     */
    getAllAccountsWithStats(): SmtpAccountWithStats[] {
        return this.accounts.map(acc => ({
            ...acc,
            sentCount: getSmtpSentCount(acc.email),
        }));
    }
}
