# Email Loop CLI

A Node.js TypeScript command-line application for email marketing automation with SMTP load balancing and AI-powered content generation.

## Features

- 📧 **SMTP Pool Management** - Load balancing across multiple Gmail accounts
- 🤖 **AI Content Generation** - Personalized emails using OpenRouter + Gemini 3.0 Pro with web search
- 💾 **SQLite Persistence** - Track send counts and email history
- 📊 **Reporting** - Detailed success/failure statistics

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create `.env` file with your OpenRouter API key:
   ```
   OPENROUTER_API_KEY=your-api-key-here
   ```

3. **Configure SMTP accounts:**
   Edit `smtp.txt` with your Gmail accounts and app passwords.

4. **Customize company info:**
   Edit `config/app.config.json` with your company details.

5. **Customize email template:**
   Edit `config/prompts/default.txt` to modify the email generation prompt.

## Usage

### Send Emails
```bash
# Send to all customers in CSV
npm run send -- --csv ./customers.csv

# Dry run (generate without sending)
npm run send -- --csv ./customers.csv --dry-run

# Custom delay between emails (ms)
npm run send -- --csv ./customers.csv --delay 5000
```

### View Report
```bash
npm run report

# Save report to file
npm run report -- --save
```

### Test SMTP Connections
```bash
npm run test-smtp
```

### View SMTP Statistics
```bash
npm run stats
```

## CSV Format

Your customer CSV file should have these columns:
- `website` (required) - Customer's website URL
- `email` (required) - Customer's email address
- `firstName` (optional) - Contact's first name
- `lastName` (optional) - Contact's last name

Example:
```csv
website,email,firstName,lastName
https://example-jam.eu,contact@example-jam.eu,John,Smith
```

## Configuration

### `config/app.config.json`
- LLM settings (model, API endpoint)
- Email rate limits
- Company information

### `config/prompts/default.txt`
Customizable prompt template with placeholders:
- `{{company.name}}`, `{{company.services}}`, `{{company.website}}`
- `{{customer.website}}`, `{{customer.email}}`, `{{customer.firstName}}`, `{{customer.lastName}}`

## Data

- `data/email-loop.db` - SQLite database with send history
- `data/report-*.json` - Saved reports
