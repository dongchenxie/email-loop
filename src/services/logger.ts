import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

class Logger {
    private logFileStream: fs.WriteStream | null = null;
    private logFilePath: string = '';

    constructor() {
        // Initialize lazily or requires explicit init call
    }

    init(logDir: string) {
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.logFilePath = path.join(logDir, `run-${timestamp}.log`);
        this.logFileStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });

        console.log(`Logging to file: ${this.logFilePath}`);
        this.log(LogLevel.INFO, `Logger initialized. Log file: ${this.logFilePath}`);
    }

    private formatMessage(level: LogLevel, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] [${level}] ${message}`;
        if (data) {
            if (data instanceof Error) {
                logMessage += `\n${data.stack || data.message}`;
            } else {
                logMessage += ` ${JSON.stringify(data)}`;
            }
        }
        return logMessage;
    }

    private log(level: LogLevel, message: string, data?: any) {
        const logMessage = this.formatMessage(level, message, data);

        // Console output (with color based on level if we wanted, keying it simple for now)
        if (level === LogLevel.ERROR) {
            console.error(logMessage);
        } else {
            console.log(logMessage);
        }

        // File output
        if (this.logFileStream) {
            this.logFileStream.write(logMessage + '\n');
        }
    }

    debug(message: string, data?: any) {
        this.log(LogLevel.DEBUG, message, data);
    }

    info(message: string, data?: any) {
        this.log(LogLevel.INFO, message, data);
    }

    warn(message: string, data?: any) {
        this.log(LogLevel.WARN, message, data);
    }

    error(message: string, error?: any) {
        this.log(LogLevel.ERROR, message, error);
    }

    close() {
        if (this.logFileStream) {
            this.logFileStream.end();
            this.logFileStream = null;
        }
    }
}

export const logger = new Logger();
