// Customer data from CSV
export interface Customer {
    website: string;
    email: string;
    firstName?: string;
    lastName?: string;
}

// SMTP account configuration
export interface SmtpAccount {
    email: string;
    appPassword: string;
}

// SMTP account with stats from database
export interface SmtpAccountWithStats extends SmtpAccount {
    sentCount: number;
    lastSentAt?: Date;
}

// Generated email content
export interface GeneratedEmail {
    subject: string;
    body: string;
}

// LLM Response structure
export interface LlmResponse {
    decision: 'EMAIL' | 'SKIP' | 'ROUTE';
    subject?: string;
    body?: string;
    reason?: string;
    company?: string;
    confidence?: string;
    next_step?: string;
    exception?: string;
}

// Email send result
export interface EmailSendResult {
    customer: Customer;
    smtpEmail: string;
    subject: string;
    status: 'success' | 'failed' | 'skipped';
    errorMessage?: string;
    sentAt: Date;
}

// Application configuration
export interface AppConfig {
    llm: {
        baseUrl: string;
        model: string;
        enableWebSearch: boolean;
    };
    email: {
        replyTo?: string;
        rateLimit: {
            perSmtp: number;
            delayBetweenEmails: number;
        };
    };
    company: {
        name: string;
        services: string[];
        website: string;
        contactEmail: string;
    };
}

// Report data
export interface SendReport {
    totalEmails: number;
    successCount: number;
    failureCount: number;
    smtpStats: {
        email: string;
        sent: number;
        failed: number;
    }[];
    failures: {
        customerEmail: string;
        smtpEmail: string;
        error: string;
    }[];
    generatedAt: Date;
}
