import OpenAI from 'openai';
import { getOpenRouterApiKey, loadConfig } from '../config';
import { AppConfig, Customer, GeneratedEmail } from '../types';
import { logger } from './logger';

export class LLMClient {
    private client: OpenAI;
    private config: AppConfig;

    constructor(config?: AppConfig) {
        this.config = config || loadConfig();

        this.client = new OpenAI({
            baseURL: this.config.llm.baseUrl,
            apiKey: getOpenRouterApiKey(),
            defaultHeaders: {
                'HTTP-Referer': this.config.company.website,
                'X-Title': 'Email Loop CLI',
            },
        });
    }

    /**
     * Generate personalized email content for a customer
     */
    async generateEmail(customer: Customer, promptTemplate: string): Promise<GeneratedEmail> {
        // Replace placeholders in prompt template
        const prompt = this.replacePlaceholders(promptTemplate, customer);

        try {
            logger.info(`Calling LLM for ${customer.email} (model: ${this.config.llm.model})`);
            // logger.debug(`Prompt:\n${prompt}`);

            // Build the request with web search enabled if configured
            const requestBody: OpenAI.ChatCompletionCreateParams = {
                model: this.config.llm.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional sales copywriter. You must respond with a valid JSON object containing "subject" and "body" fields.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.7,
                max_tokens: 5000,
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "email_response",
                        strict: true,
                        schema: {
                            type: "object",
                            properties: {
                                subject: {
                                    type: "string",
                                    description: "The subject line of the email"
                                },
                                body: {
                                    type: "string",
                                    description: "The body content of the email"
                                }
                            },
                            required: ["subject", "body"],
                            additionalProperties: false
                        }
                    }
                }
            };

            // Enable web search via OpenRouter plugins if configured
            if (this.config.llm.enableWebSearch) {
                (requestBody as any).plugins = [{ id: 'web' }];
            }

            const response = await this.client.chat.completions.create(requestBody);

            const content = response.choices[0]?.message?.content;

            if (!content) {
                throw new Error('Empty response from LLM');
            }

            logger.info(`Received LLM response for ${customer.email}:\n${content}`);

            // Parse JSON response (it should be valid JSON now)
            return JSON.parse(content);
        } catch (error) {
            logger.error(`Error generating email for ${customer.email}:`, error);
            throw error;
        }
    }

    private replacePlaceholders(template: string, customer: Customer): string {
        let result = template;

        // Customer placeholders
        result = result.replace(/\{\{customer\.website\}\}/g, customer.website);
        result = result.replace(/\{\{customer\.email\}\}/g, customer.email);
        result = result.replace(/\{\{customer\.firstName\}\}/g, customer.firstName || '');
        result = result.replace(/\{\{customer\.lastName\}\}/g, customer.lastName || '');

        // Company placeholders
        result = result.replace(/\{\{company\.name\}\}/g, this.config.company.name);
        result = result.replace(/\{\{company\.services\}\}/g, this.config.company.services.join(', '));
        result = result.replace(/\{\{company\.website\}\}/g, this.config.company.website);
        result = result.replace(/\{\{company\.contactEmail\}\}/g, this.config.company.contactEmail);

        return result;
    }

    private parseEmailResponse(content: string): GeneratedEmail {
        // Try multiple extraction patterns
        const patterns = [
            // JSON in code block with json language
            /```json\s*([\s\S]*?)\s*```/,
            // JSON in code block without language
            /```\s*([\s\S]*?)\s*```/,
            // Raw JSON object
            /(\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\})/,
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                try {
                    const jsonStr = match[1].trim();
                    const parsed = JSON.parse(jsonStr);

                    if (parsed.subject && parsed.body) {
                        return {
                            subject: parsed.subject,
                            body: parsed.body,
                        };
                    }
                } catch (e) {
                    // Try next pattern
                    continue;
                }
            }
        }

        // Try parsing entire content as JSON
        try {
            const parsed = JSON.parse(content.trim());
            if (parsed.subject && parsed.body) {
                return {
                    subject: parsed.subject,
                    body: parsed.body,
                };
            }
        } catch (e) {
            logger.warn('Failed to parse LLM response as JSON, using fallback');
        }

        // Fallback: use content as body and generate a generic subject
        return {
            subject: 'Partnership Opportunity - Premium Glass Jars',
            body: content,
        };
    }
}
