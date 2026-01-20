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

// Email send result
export interface EmailSendResult {
    customer: Customer;
    smtpEmail: string;
    subject: string;
    status: 'success' | 'failed';
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
