# CashCove Expansion Plan

Created: 2026-05-19

This document tracks the product and engineering plan for expanding CashCove from a finance tracker into a broader personal finance management system. It is intentionally separate from `README.md`, which should remain focused on setup, stack, deployment, and existing app behavior.

## Current Decision Record

### Product Priority

Phase 1 will focus on richer Loans and Home Loans.

The existing Loans module already supports:

- Loan records
- EMI schedules
- Partial installment payment state
- Loan payment posting
- Payment reversal and edit flows
- Rate revisions
- Overdue and upcoming EMI reminders
- Linked expense transactions for loan payments

Because this foundation exists, the safest path is to extend the current Loans module rather than create a duplicate home-loan system.

### Finance Scope

For now, new finance features should support India-focused INR mode.

Working assumptions:

- Currency: INR
- Locale: India-oriented formatting and labels
- Tax and deduction features should be configurable and/or user-entered until rules are confirmed.
- Do not hard-code personal tax rules blindly.
- Do not provide financial, tax, or legal advice inside the app. Calculations should be shown as estimates or recordkeeping aids unless backed by explicit user-provided values.

## Phase 1: Richer Loans and Home Loans

### Goal

Upgrade the existing Loans page into a stronger loan management workspace, with home-loan-specific capabilities layered on top of the generic loan model.

### Required Capabilities

Phase 1 should include:

- Repayment tracking
- Property details
- Bank and loan account details
- Tax benefit tracking
- Prepayment planning
- Interest certificate or statement export
- Floating-rate history

### Proposed Architecture

Keep the current `loans`, `loan_schedule`, `loan_payments`, and `loan_rate_revisions` tables as the core repayment engine.

Add focused extension data instead of widening one table endlessly:

- Home loan profile details
- Property/security details
- Lender/bank account details
- Tax benefit records or yearly summaries
- Prepayment plan scenarios
- Export helpers for interest certificate data

The UI should stay modular:

- Existing `Loans` page remains the entry point.
- Loan details drawer can become the richer record view.
- Home-loan-only panels should appear only when the loan type is home loan.
- New components should live under `src/components/loans`.
- New business logic should live under `src/lib/loans` or a nearby focused helper.
- New RTK Query endpoints should extend `src/features/api/loansApi.ts` or split into a focused API module if the file becomes too large.

### Suggested Phase Breakdown

#### Phase 1A: Data Model and Read Path

- Add migration for home loan extension records.
- Add TypeScript types.
- Add read APIs for home loan details.
- Add safe empty states in the existing loan details UI.
- Test schema-facing helpers and mapping functions.

#### Phase 1B: Home Loan Profile UI

- Add edit/create form for:
  - Property name or address label
  - Property type
  - Possession/registration date
  - Lender branch or relationship manager
  - Loan account number
  - Linked repayment account
  - Sanctioned amount
  - Disbursement amount
  - Optional notes

Sensitive account identifiers should be masked in UI where practical.

#### Phase 1C: Floating Rate History

- Reuse current rate revision foundation.
- Add richer history display:
  - Effective date
  - Old rate
  - New rate
  - EMI impact
  - Tenure impact
  - User note
- Keep calculations explainable and avoid changing schedules without explicit user action.

#### Phase 1D: Prepayment Planning

- Add scenario planner without mutating actual loan data.
- Inputs:
  - One-time prepayment amount
  - Planned date
  - Choice of reduce tenure or reduce EMI
- Outputs:
  - Estimated interest saved
  - Estimated payoff change
  - Revised outstanding projection
- Actual posting of prepayments should remain separate and explicit.

#### Phase 1E: Tax Benefit Tracking

- Store yearly user-entered summaries and derived estimates separately.
- Avoid hard-coded tax-rule claims until confirmed.
- Support basic recordkeeping:
  - Financial year
  - Principal paid
  - Interest paid
  - Eligible principal claimed
  - Eligible interest claimed
  - User notes
- Later, if tax rules are automated, use official/current sources and keep rules versioned.

#### Phase 1F: Interest Certificate and Export

- Add export from existing payment/schedule data.
- Initial format can be CSV or printable HTML.
- Include:
  - Borrower/user label
  - Lender
  - Loan account number, masked if needed
  - Date range or financial year
  - Principal paid
  - Interest paid
  - Fees paid
  - EMI/payment rows
- Clearly label it as app-generated unless it is an uploaded official bank certificate.

## Future Modules

After Phase 1, planned modules are:

- LIC policy tracking
- Term insurance and term plan tracking
- Mutual fund tracking
- Unified upcoming payments dashboard
- Better financial overview dashboard

These should be implemented one module at a time, with questions answered before each module starts.

## Pending Product Questions

Before coding Phase 1, confirm:

1. Should home loans be a loan type inside the existing Loans page, or should there also be a separate Home Loan navigation item?
2. Which property fields matter most for your usage: address, registration value, market value, possession date, builder/society, co-owner, or document links?
3. Should loan account number be stored plainly like existing notes, or should we add a masking-first field and avoid showing the full value by default?
4. For tax tracking, should the app use Indian financial year April to March by default?
5. Should interest certificate export be CSV first, printable PDF-style HTML first, or both?
6. For prepayment planning, should the default mode be reduce tenure, reduce EMI, or show both side by side?
7. Should bank/account details link to existing CashCove accounts, or should they be separate lender/loan account fields?

## Engineering Guardrails

- Do not rewrite the project.
- Do not remove existing working functionality.
- Do not create a single large all-in-one component.
- Prefer small components and domain helpers.
- Preserve current loan repayment behavior.
- Add migrations instead of changing existing schema destructively.
- Add tests after each phase.
- Run regression checks after each phase:

```bash
npm run test
npm run build
```

## Testing Strategy

For every phase:

- Add focused unit tests for new loan calculations.
- Add mapping tests for new data shapes where practical.
- Run existing loan tests.
- Run the full Vitest suite.
- Run production build before considering the phase complete.

## Notes From Initial Repository Inspection

- The app uses Vite, React, TypeScript, Mantine, Recharts, Redux Toolkit, RTK Query, and Supabase.
- Main app routes are registered in `src/app/routes.tsx`.
- API endpoints are implemented in `src/features/api`.
- Domain types are centralized in `src/types/finance.ts`.
- Current loans logic is in `src/lib/loans.ts` and `src/features/api/loansApi.ts`.
- Current loan UI lives under `src/pages/Loans.tsx` and `src/components/loans`.
- Data is primarily stored in Supabase Postgres with RLS.
- Local storage and IndexedDB are used only for UI preferences and offline transaction queueing.
