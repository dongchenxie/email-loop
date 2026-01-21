import OpenAI from 'openai';
import { getOpenRouterApiKey, loadConfig } from '../config';
import { AppConfig, Customer, GeneratedEmail, LlmResponse } from '../types';
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
    async generateEmail(customer: Customer, promptTemplate: string): Promise<LlmResponse> {
        // Replace placeholders in prompt template
        const prompt = this.replacePlaceholders(promptTemplate, customer);

        try {
            logger.info(`Calling LLM for ${customer.email} (model: ${this.config.llm.model})`);

            // Build the request with web search enabled if configured
            const requestBody: OpenAI.ChatCompletionCreateParams = {
                model: this.config.llm.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional sales copywriter. You must respond with a valid JSON object.',
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
                                decision: {
                                    type: "string",
                                    enum: ["EMAIL", "SKIP", "ROUTE"],
                                    description: "Decision whether to send an email, skip, or route to another department."
                                },
                                subject: {
                                    type: ["string", "null"],
                                    description: "The subject line of the email (required if decision is EMAIL)"
                                },
                                body: {
                                    type: ["string", "null"],
                                    description: "The body content of the email (required if decision is EMAIL)"
                                },
                                reason: {
                                    type: ["string", "null"],
                                    description: "Reason for the decision"
                                },
                                company: {
                                    type: ["string", "null"],
                                    description: "Company name or website"
                                },
                                confidence: {
                                    type: ["string", "null"],
                                    description: "Confidence level of the decision"
                                },
                                next_step: {
                                    type: ["string", "null"],
                                    description: "Next step if decision is ROUTE"
                                },
                                exception: {
                                    type: ["string", "null"],
                                    description: "Exception notes if decision is SKIP"
                                }
                            },
                            required: ["decision", "subject", "body", "reason", "company", "confidence", "next_step", "exception"],
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
            logger.info(`LLM response`, response)
            const content = response.choices[0]?.message?.content;

            if (!content) {
                throw new Error('Empty response from LLM');
            }

            logger.info(`Received LLM response for ${customer.email}:\n${content}`);

            // Parse JSON response (it should be valid JSON now)
            try {
                return JSON.parse(content) as LlmResponse;
            } catch (parseError) {
                logger.warn(`JSON parse failed, attempting repair for ${customer.email}: ${parseError}`);
                // Basic repair for truncated JSON
                let repairedContent = content.trim();
                // If it ends with a quote but no brace, add brace
                if (repairedContent.endsWith('"')) {
                    repairedContent += "}";
                } else if (!repairedContent.endsWith('}')) {
                    // unexpected end, try to close the last open string and object
                    repairedContent += '"}';
                }

                try {
                    return JSON.parse(repairedContent) as LlmResponse;
                } catch (repairError) {
                    logger.error(`Repair failed: ${repairError}`);
                    throw parseError;
                }
            }
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
