import { Customer, GeneratedEmail } from '../types';
import { AppConfig } from '../types';
import { LLMClient } from './llm-client';
import { loadPromptTemplate } from '../config';
import { logger } from './logger';

export class EmailGenerator {
    private llmClient: LLMClient;
    private promptTemplate: string;

    constructor(config?: AppConfig, promptPath?: string) {
        this.llmClient = new LLMClient(config);
        this.promptTemplate = loadPromptTemplate(promptPath);
    }

    /**
     * Generate personalized email for a customer
     */
    async generateEmail(customer: Customer): Promise<GeneratedEmail> {
        logger.info(`Generating email for ${customer.email} (${customer.website})...`);

        const email = await this.llmClient.generateEmail(customer, this.promptTemplate);

        logger.info(`Generated subject: ${email.subject}`);

        return email;
    }
}
