# Worthwise

Worthwise is an INR-first personal finance management app for tracking cashflow, loans, home loans, insurance, investments, and upcoming payments.

This repository is a greenfield rebuild. The previous Cash Cove app is reference material only; this version starts with a cleaner module structure and a Supabase schema that can run from an empty local database.

## Stack

- Vite
- React
- TypeScript
- Mantine
- Redux Toolkit and RTK Query
- React Router
- Supabase Auth and Postgres
- Recharts
- Vitest

## Local Setup

Install dependencies:

```bash
npm install
```

Start Supabase locally:

```bash
supabase start
```

Supabase Studio will be available at `http://127.0.0.1:54323`.

Create `.env` from `.env.example` and paste the local Supabase publishable key printed by `supabase start`.

Run the app:

```bash
npm run dev
```

The Vite app runs at `http://127.0.0.1:5173`.

Run checks:

```bash
npm run typecheck
npm run lint
npm run test
npm audit --omit=dev
npm run build
```

Local analytics and edge runtime are disabled in `supabase/config.toml` for the foundation phase. That keeps local startup lighter and avoids Colima Docker socket mount issues until those services are actually needed.

## Product Plan

The detailed plan is maintained in [ROADMAP.md](./ROADMAP.md).

## Current Phase

Phase 0: greenfield foundation.

The first implementation target after the foundation is the richer Loans/Home Loans module with repayment tracking, property details, tax-benefit placeholders, prepayment planning, interest certificate/export support, floating-rate history, and bank/account details.
