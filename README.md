# CashCove

CashCove is a personal finance SaaS for running the full monthly money system in one place: transactions, bills, subscriptions, budgets, funds, loans, cashflow, reports, and capture workflows.

## Product surface

### Track
- transactions across bank, card, cash, and wallet accounts
- shared-spend entries and reimbursements
- tags, notes, saved filter views, and global search
- offline queueing for simple transaction creates

### Plan
- monthly budgets with soft-cap alerts
- bills calendar for recurring dues and overdue items
- subscription tracking and posting
- savings funds / sinking funds
- loans, EMIs, payment posting, and rate revisions

### Capture
- quick add drawer
- CSV import
- Telegram bot capture
- forwarded email parsing for bank/payment alerts
- text-based PDF statement parsing

### Review
- dashboard with budget and due-soon attention items
- cashflow and reports views
- weekly summary emails
- reconciliation and settings workspace

## Route structure
- `/` public landing page
- `/login` auth entry
- `/app` authenticated product shell

## Stack
- Vite + React + TypeScript
- Redux Toolkit + RTK Query
- Supabase Auth + Postgres
- Mantine
- Recharts
- Netlify Functions + Scheduled Functions

## Local setup

1. Install dependencies
```bash
npm install
```

2. Create a Supabase project
- Run `supabase/schema.sql` in the Supabase SQL editor.
- Apply any additional migrations in `supabase/migrations` if your local or remote project is behind the repo state.

3. Configure frontend env vars
- Copy `.env.example` to `.env`
- Required:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Optional:
  - `VITE_EMAIL_INGEST_DOMAIN`

4. Run the app
```bash
npm run dev
```

## Regression checks
Before pushing routing, bundle, or data-flow changes, run:

```bash
npm run test:regression
```

This runs the Vitest suite and then the production build.

## Demo login
The demo login is issued server-side through the Supabase Edge Function `demo-login`.

Required Supabase function secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEMO_EMAIL`
- `DEMO_PASSWORD`

Deploy:
```bash
supabase functions deploy demo-login
```

Example secret setup:
```bash
supabase secrets set DEMO_EMAIL="demo@cashcove.in" DEMO_PASSWORD="<demo-password>"
```

## Netlify deployment
CashCove is set up to run on Netlify.

Required Netlify env vars:
```env
SUPABASE_URL=https://pnxvflbyvhawztmbsguk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
RESEND_API_KEY=<your-resend-api-key>
RESEND_FROM_EMAIL=CashCove <cashcove@middle-earth.in>
CASHCOVE_APP_URL=https://cashcove.middle-earth.in
CASHCOVE_CURRENCY=INR
CASHCOVE_LOCALE=en-IN
```

Optional when you enable inbound email parsing:
```env
EMAIL_INGEST_SECRET=<generate-a-long-random-secret>
VITE_EMAIL_INGEST_DOMAIN=<your-inbound-domain>
```

## Email surfaces
CashCove has three distinct email surfaces.

### 1. Weekly summary emails
Runs through the Netlify Scheduled Function:
- `netlify/functions/weekly-summary.js`

What it needs:
- Netlify env vars above
- users enable the schedule in Settings

### 2. Supabase auth emails
Used for signup confirmation and other auth mail.

Configure in Supabase:
- `Authentication` -> `Email` -> enable `Custom SMTP`

Resend SMTP values:
```text
Host: smtp.resend.com
Port: 465
Username: resend
Password: <your-resend-api-key>
Sender name: CashCove
Sender email: cashcove@middle-earth.in
```

Also ensure:
- `Site URL` is your deployed frontend URL
- redirect URLs include your production auth destination

### 3. Inbound email parsing (beta)
Incoming bank or payment alert emails can be forwarded into:
- `netlify/functions/email-forward-parser.ts`
- deployed path: `/.netlify/functions/email-forward-parser`

Required env:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Recommended:
- `EMAIL_INGEST_SECRET`
- `VITE_EMAIL_INGEST_DOMAIN`

Routing priority:
1. explicit `user_id`
2. recipient alias like `cc_<user-id-no-dashes>@your-inbound-domain`
3. sender email match

Dry-run example:
```bash
curl -X POST "https://<your-site>.netlify.app/.netlify/functions/email-forward-parser?dry_run=1" \
  -H "Content-Type: application/json" \
  -H "x-cashcove-ingest-secret: <EMAIL_INGEST_SECRET>" \
  -d '{
    "from": "you@example.com",
    "subject": "Fwd: bank alert",
    "text": "rs 60 at VC Cafe via UPI category food tags lunch"
  }'
```

## Telegram capture
Telegram capture runs through the Supabase Edge Function:
- `supabase/functions/telegram-bot`

Required function secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`

Deploy:
```bash
supabase functions deploy telegram-bot
```

## PDF import
CashCove supports text-based PDF statement parsing through the transaction import flow.

Current status:
- generic parser support is implemented
- bank-specific heuristics exist for common statement shapes
- scanned/image-only PDFs still need OCR

## Apex-domain sending across multiple apps
If you verify `middle-earth.in` once in Resend, you can send from multiple apps using different sender addresses.

Recommended sender mapping:
```text
CashCove: cashcove@middle-earth.in
Vehicle Vault: vehicle-vault@middle-earth.in
Portfolio: portfolio@middle-earth.in
```

## Notes and current limits
- notes are currently stored as plain text
- offline queueing is intentionally limited to simple transaction creates
- account transfers, spend-from-fund, subscription post-payment, and similar compound flows remain online-only
- inbound email parsing and OCR are still operationally hardening areas
