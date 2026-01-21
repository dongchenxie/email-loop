import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { AppConfig } from '../types';

// Load environment variables
dotenv.config();

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'config', 'app.config.json');
const DEFAULT_PROMPT_PATH = path.join(process.cwd(), 'config', 'prompts', 'default.txt');
const DEFAULT_SMTP_PATH = path.join(process.cwd(), 'smtp.csv');

export function loadConfig(configPath?: string): AppConfig {
    const filePath = configPath || DEFAULT_CONFIG_PATH;

    if (!fs.existsSync(filePath)) {
        throw new Error(`Configuration file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as AppConfig;
}

export function loadPromptTemplate(promptPath?: string): string {
    const filePath = promptPath || DEFAULT_PROMPT_PATH;

    if (!fs.existsSync(filePath)) {
        throw new Error(`Prompt template not found: ${filePath}`);
    }

    return fs.readFileSync(filePath, 'utf-8');
}

export function getOpenRouterApiKey(): string {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY not found in environment variables. Please check your .env file.');
    }

    return apiKey;
}

export function getReplyTo(): string | undefined {
    return process.env.REPLY_TO;
}

export function getSmtpFilePath(): string {
    return DEFAULT_SMTP_PATH;
}

export function getDataDir(): string {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
}

export function getDatabasePath(): string {
    return path.join(getDataDir(), 'email-loop.db');
}
