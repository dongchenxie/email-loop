import { Customer, LlmResponse } from '../types';
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
    async generateEmail(customer: Customer): Promise<LlmResponse> {
        logger.info(`Generating email for ${customer.email} (${customer.website})...`);

        const result = await this.llmClient.generateEmail(customer, this.promptTemplate);

        if (result.decision === 'EMAIL') {
            logger.info(`Generated subject: ${result.subject}`);
        } else {
            logger.info(`Decision: ${result.decision} (Reason: ${result.reason})`);
        }

        return result;
    }
}
