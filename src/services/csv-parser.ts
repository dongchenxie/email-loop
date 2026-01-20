import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { Customer } from '../types';
import { logger } from './logger';

// Type for CSV record with flexible column names
type CsvRecord = Record<string, string | undefined>;

export function parseCSV(filePath: string): Customer[] {
    if (!fs.existsSync(filePath)) {
        throw new Error(`CSV file not found: ${filePath}`);
    }

    logger.info(`Parsing CSV file: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');

    const records: CsvRecord[] = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
    });

    const customers: Customer[] = [];

    for (const record of records) {
        // Support multiple column name variations
        const website = record.website || record.Website || record.url || record.URL || record.site;
        const email = record.email || record.Email || record.contact || record.Contact;
        const firstName = record.firstName || record.firstname || record.first_name || record.FirstName || record['First Name'];
        const lastName = record.lastName || record.lastname || record.last_name || record.LastName || record['Last Name'];

        if (!website || !email) {
            logger.warn(`Skipping row: missing required fields (website or email)`, record);
            continue;
        }

        customers.push({
            website: website.trim(),
            email: email.trim(),
            firstName: firstName?.trim(),
            lastName: lastName?.trim(),
        });
    }

    return customers;
}
