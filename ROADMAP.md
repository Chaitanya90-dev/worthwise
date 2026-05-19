# Cash Cove Roadmap

Single source of truth for product roadmap, shipping status, and remaining work.

## Immediate next

- [ ] Telegram live monitoring: review diagnostics from ongoing real chat usage and tune new parser misses.
- [ ] Email forwarding parser: verify end-to-end delivery against a real provider webhook.
- [ ] PDF parser hardening: run real bank/card statement samples through the importer and tune misses from production layouts.
- [ ] Recurring expense auto-log: create due recurring transactions automatically from known recurring patterns/subscriptions.
- [x] Build optimization + regression gate: route-level lazy loading, vendor chunking, and a dedicated `npm run test:regression` gate are in place. Current build emits a `370.86 kB` app entry chunk (`108.48 kB` gzip) plus an isolated shared grid chunk at `708.79 kB` (`201.77 kB` gzip) under the calibrated warning threshold.

## Engineering: Build Health

- [x] Regression gate for bundle work
  - [x] Inventory the current regression tests and identify gaps around route loading, tables, charts, auth shell, and import flows
  - [x] Add missing route/navigation tests needed to make route-level code splitting safe to ship
  - [x] Define the minimum pre-push regression suite for build-related changes via `npm run test:regression`
- [x] Reduce the Vite startup bundle
  - [x] Convert page routes to lazy loading so all pages are not shipped in the initial entry chunk
  - [x] Move AG Grid out of the app entry path and isolate table feature sets behind lazy wrappers
  - [x] Add a `manualChunks` strategy in `vite.config.ts` for Mantine, charts, router, and Supabase vendor code
  - [x] Rebuild and compare chunk output before pushing

## Tier 1: Smart Text Import ⚡

Paste bank SMS, UPI notifications, or free-form notes, then auto-parse, preview, edit, and import.

- [x] Smart Text parser core (`smartTextParser.ts`)
  - [x] Line splitter + template matcher dispatcher
  - [x] Bank SMS parser templates
    - [x] OneCard (BOB Financial) CC alerts
    - [x] Amazon Pay ICICI CC alerts
    - [x] Bank of Baroda debit/UPI alerts
  - [x] UPI app notification parser (GPay, PhonePe generic)
  - [x] Generic Indian bank SMS parser (fallback patterns)
  - [x] Free-form notes parser (`date text amount` style)
  - [x] Fuzzy date + amount extractor (last-resort fallback)
- [x] Integration with existing rules engine for auto-categorization
- [x] Smart Import UI
  - [x] "Smart Paste" tab in Import Modal
  - [x] Textarea for pasting multi-line text
  - [x] Format auto-detection indicator
  - [x] Editable preview table via existing `PreviewSection`
  - [x] Per-line parse status
- [x] Unit tests for parser templates
- [x] Manual testing with real SMS and Telegram samples

## Tier 2: Quick Bulk Entry Grid 📊

Spreadsheet-like rapid entry with autofill and quick templates.

- [x] Bulk entry grid component
  - [x] Minimal columns: Date | Amount | Merchant/Notes
  - [x] Tab-through keyboard navigation
  - [x] Auto-fill category/payment/account from rules as merchant is typed
  - [x] Inline validation
  - [x] Add row / duplicate row shortcuts
  - [x] Sticky default date with auto-increment option
- [x] Quick Templates system
  - [x] Save frequent expense patterns as one-click shortcuts
  - [x] Template CRUD (create, edit, delete)
  - [x] Storage in Supabase (`quick_templates` table)
  - [x] Template picker UI
- [x] Entry point from Quick Actions or dedicated flow

## Tier 3: Automation & Connectors 🔌

Longer-term features for maximum automation.

- [ ] Telegram Bot rollout
  - [x] Telegram settings flow with chat ID linking
  - [x] Supabase Edge Function bot endpoint
  - [x] Free-form parser for amount, merchant, notes, account, payment, and category
  - [x] Fuzzy matching against saved accounts, payment methods, and categories
  - [x] Tag parsing from `tags ...` and `#hashtags`
  - [x] Optional strict `key=value; ...` syntax for low-ambiguity parsing
  - [x] Deploy webhook and verify end-to-end delivery from Telegram
  - [x] Telegram diagnostics UI in Settings for reviewing parser outcomes/failures
  - [x] Persist parser outcomes/failures to `telegram_ingest_events`
  - [x] Decide whether Smart Paste and Telegram share one parser implementation
  - [x] Idempotent webhook handling for Telegram retry/delivery duplicates
  - [x] Income parsing, multiline normalization, and command/status responses for chat-style messages
  - [x] Stronger diagnostics export with parsed hints and top failure reasons
  - [x] Live test with real chat messages and capture failure samples
- [ ] Email forwarding parser
  - [x] Netlify function endpoint (`email-forward-parser`)
  - [x] Reuse Smart parser + rules to auto-import parsed transactions
  - [x] Dry-run mode and optional ingest secret guard
  - [x] Handle JSON, form-urlencoded, and multipart inbound payloads
  - [x] Provider inbound routing coverage via handler tests
  - [x] Reusable dry-run smoke script
  - [ ] Live forwarding verification against a real provider webhook
- [ ] PDF statement parser
  - [x] "PDF statement" tab in Transaction Import
  - [x] Extract text locally from text-based PDF content streams
  - [x] Parse generic statement rows with debit/credit/balance heuristics
  - [x] Stitch wrapped multi-line descriptions
  - [x] Infer payment/account hints and reuse rules/default mappings
  - [x] Add bank-specific heuristics for HDFC, ICICI, SBI, Axis, and Amex layouts
  - [x] Add parser tests for generic and bank-specific statement formats
  - [ ] Tune against real uploaded statement PDFs from each supported bank/card issuer
  - [ ] Add OCR fallback for scanned/image-only PDFs
- [ ] Photo and receipt OCR
  - [ ] Upload receipt photos
  - [ ] Extract amount, merchant, and date via OCR
  - [ ] Share OCR fallback path with scanned PDF statements where possible
- [x] Offline mode
  - [x] Queue simple transaction writes locally from transaction create flows
  - [x] Auto-sync queued transactions when connectivity returns
  - [x] Topbar status indicators for offline/sync/queued count
  - [x] Guard multi-step actions (transfer/card payment/fund spend/subscription post) to require connectivity
- [ ] Recurring expense auto-log
  - [ ] Auto-create known recurring transactions on due dates
  - [ ] Extend the subscriptions module into transaction creation
- [ ] Custom parser templates
  - [ ] Let users define regex-based SMS parser templates for unsupported banks
- [ ] WhatsApp payment receipt parser
  - [ ] Parse forwarded payment confirmations from WhatsApp

## General UX Improvements

- [x] Counterparty/merchant field: store who the money went to/from and enable filters/search
- [x] Consolidate actions per screen: one primary CTA + compact "More actions" menu
- [x] Stronger empty states: guidance + one-click sample or import CTA
- [x] Consistent status chips on every page header
- [x] Global search overhaul across pages, actions, and workspace records
- [x] Saved filter chips, clear actions, and saved filter presets on core search/filter screens
- [x] Transactions filter overhaul: stronger search, range filters, flags, tags, and saved-filter sync
- [x] Smarter filters: sticky bars and parity on the remaining screens
- [x] Mobile navigation parity via footer + "More" overflow
- [x] Table readability: zebra striping, hover highlight, sticky headers

## Loans: Correctness and Control

- [x] Partial EMI state with installment-level paid totals (principal, interest, fees, total)
- [x] Payment reversal flow with full rollback of linked balances and schedule state
- [x] Payment edit flow without delete-repost
- [x] Payoff and interest analytics cards (interest paid vs remaining, prepayment savings)
- [x] EMI reminder and due UX (upcoming panel, overdue severity, quick post CTA)
