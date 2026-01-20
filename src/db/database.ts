import Database from 'better-sqlite3';
import { getDatabasePath } from '../config';
import { EmailSendResult } from '../types';

let db: Database.Database | null = null;

export function initDatabase(): Database.Database {
    if (db) return db;

    db = new Database(getDatabasePath());

    // Create tables if not exist
    db.exec(`
    CREATE TABLE IF NOT EXISTS smtp_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      sent_count INTEGER DEFAULT 0,
      last_sent_at DATETIME
    );
    
    CREATE TABLE IF NOT EXISTS email_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_email TEXT NOT NULL,
      customer_website TEXT NOT NULL,
      smtp_email TEXT NOT NULL,
      subject TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      sent_at DATETIME NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_email_history_smtp ON email_history(smtp_email);
    CREATE INDEX IF NOT EXISTS idx_email_history_status ON email_history(status);
  `);

    return db;
}

export function getDatabase(): Database.Database {
    if (!db) {
        return initDatabase();
    }
    return db;
}

export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
    }
}

// SMTP account operations
export function ensureSmtpAccount(email: string): void {
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT OR IGNORE INTO smtp_accounts (email, sent_count) VALUES (?, 0)
  `);
    stmt.run(email);
}

export function getSmtpSentCount(email: string): number {
    const db = getDatabase();
    ensureSmtpAccount(email);
    const stmt = db.prepare('SELECT sent_count FROM smtp_accounts WHERE email = ?');
    const row = stmt.get(email) as { sent_count: number } | undefined;
    return row?.sent_count ?? 0;
}

export function incrementSmtpSentCount(email: string): void {
    const db = getDatabase();
    ensureSmtpAccount(email);
    const stmt = db.prepare(`
    UPDATE smtp_accounts 
    SET sent_count = sent_count + 1, last_sent_at = datetime('now') 
    WHERE email = ?
  `);
    stmt.run(email);
}

export function getAllSmtpStats(): { email: string; sentCount: number; lastSentAt: string | null }[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT email, sent_count as sentCount, last_sent_at as lastSentAt FROM smtp_accounts');
    return stmt.all() as { email: string; sentCount: number; lastSentAt: string | null }[];
}

// Email history operations
export function recordEmailSent(result: EmailSendResult): void {
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO email_history (customer_email, customer_website, smtp_email, subject, status, error_message, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(
        result.customer.email,
        result.customer.website,
        result.smtpEmail,
        result.subject,
        result.status,
        result.errorMessage || null,
        result.sentAt.toISOString()
    );
}

export function getEmailHistory(limit: number = 100): EmailSendResult[] {
    const db = getDatabase();
    const stmt = db.prepare(`
    SELECT customer_email, customer_website, smtp_email, subject, status, error_message, sent_at
    FROM email_history
    ORDER BY sent_at DESC
    LIMIT ?
  `);
    const rows = stmt.all(limit) as any[];

    return rows.map(row => ({
        customer: {
            email: row.customer_email,
            website: row.customer_website,
        },
        smtpEmail: row.smtp_email,
        subject: row.subject,
        status: row.status,
        errorMessage: row.error_message || undefined,
        sentAt: new Date(row.sent_at),
    }));
}

export function getReportStats(): {
    totalEmails: number;
    successCount: number;
    failureCount: number;
    smtpStats: { email: string; sent: number; failed: number }[];
    recentFailures: { customerEmail: string; smtpEmail: string; error: string }[];
} {
    const db = getDatabase();

    // Get total counts
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM email_history');
    const successStmt = db.prepare("SELECT COUNT(*) as count FROM email_history WHERE status = 'success'");
    const failureStmt = db.prepare("SELECT COUNT(*) as count FROM email_history WHERE status = 'failed'");

    const total = (totalStmt.get() as { count: number }).count;
    const success = (successStmt.get() as { count: number }).count;
    const failure = (failureStmt.get() as { count: number }).count;

    // Get per-SMTP stats
    const smtpStatsStmt = db.prepare(`
    SELECT 
      smtp_email as email,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM email_history
    GROUP BY smtp_email
  `);
    const smtpStats = smtpStatsStmt.all() as { email: string; sent: number; failed: number }[];

    // Get recent failures
    const failuresStmt = db.prepare(`
    SELECT customer_email as customerEmail, smtp_email as smtpEmail, error_message as error
    FROM email_history
    WHERE status = 'failed'
    ORDER BY sent_at DESC
    LIMIT 20
  `);
    const recentFailures = failuresStmt.all() as { customerEmail: string; smtpEmail: string; error: string }[];

    return {
        totalEmails: total,
        successCount: success,
        failureCount: failure,
        smtpStats,
        recentFailures,
    };
}
