import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Search,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { type ReactNode, useRef } from "react";
import { Link } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import { APP_BASE_PATH, PUBLIC_HOME_PATH, loginPath } from "../app/paths";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

const valuePoints = [
  {
    title: "Track spending with context",
    description:
      "Searchable activity, categories, accounts, tags, and recent movement live in one operational ledger instead of scattered notes and bank apps.",
    icon: Search,
  },
  {
    title: "Stay ahead of budgets and renewals",
    description:
      "CashCove puts recurring bills, subscription dates, soft-cap warnings, and due-soon signals into one monthly control surface.",
    icon: CalendarDays,
  },
  {
    title: "Understand cashflow before it bites you",
    description:
      "See balances, runway, category pressure, and recent changes early enough to act before the month turns reactive.",
    icon: BarChart3,
  },
] as const;

const storySections = [
  {
    eyebrow: "Observe",
    title: "See the shape of the month, not just raw transactions.",
    description:
      "CashCove keeps account balances, category drift, and recent activity in one view, so spending has context instead of just a timestamp and amount.",
    kind: "activity" as const,
  },
  {
    eyebrow: "Operate",
    title: "Run budgets, renewals, and obligations before they surprise you.",
    description:
      "Budgets, bills, subscriptions, EMIs, and funds are handled as one operating cycle. You stop remembering dates manually and start working from a calm system.",
    kind: "runway" as const,
  },
  {
    eyebrow: "Decide",
    title: "Move from logging money to steering it.",
    description:
      "Cashflow views, reports, daily pulse, and recent change signals make the app useful between paydays, not just when you reconcile at month end.",
    kind: "insights" as const,
  },
] as const;

const trustPoints = [
  {
    title: "Private by posture",
    description: "Designed as a personal cockpit, not a noisy social feed or points engine.",
    icon: ShieldCheck,
  },
  {
    title: "Built for real monthly life",
    description: "Budgets, bills, subscriptions, loans, goals, balances, and recent activity belong together.",
    icon: Wallet,
  },
  {
    title: "Friction trimmed where it matters",
    description: "Quick add, search, email parsing, Telegram capture, and PDF imports reduce clerical work.",
    icon: Zap,
  },
] as const;

const heroRenewals = [
  { name: "B2 Rent", amount: "₹20,000", due: "01 Apr" },
  { name: "Google", amount: "₹1,950", due: "12 Apr" },
  { name: "Axis MaxLife", amount: "₹1,198", due: "21 Apr" },
] as const;

const recentActivity = [
  { label: "BigBasket", meta: "Groceries · Amazon Pay Card", amount: "-₹2,410" },
  { label: "Salary", meta: "Income · BOB Savings", amount: "+₹84,000" },
  { label: "Spotify Family", meta: "Renewal · UPI autopay", amount: "-₹179" },
] as const;

const balanceRail = [
  { name: "BOB Savings", amount: "₹1.84L" },
  { name: "HDFC Platinum", amount: "₹42,600" },
  { name: "Emergency fund", amount: "₹86,000" },
] as const;

const showcaseCategories = [
  { name: "Home", value: "28%", width: "72%" },
  { name: "Food", value: "16%", width: "49%" },
  { name: "Mobility", value: "11%", width: "38%" },
  { name: "Health", value: "9%", width: "28%" },
] as const;

const showcaseAccounts = [
  { name: "Operating cash", value: "₹2.26L" },
  { name: "Bills reserve", value: "₹54,000" },
  { name: "Goals funded", value: "₹1.12L" },
] as const;

const heroPreviewHoverTransition = {
  type: "spring",
  stiffness: 220,
  damping: 22,
  mass: 0.9,
} as const;

const Reveal = ({ children, className, delay = 0 }: RevealProps) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? undefined : { opacity: 0, y: 28 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

const StoryPanel = ({ kind }: { kind: (typeof storySections)[number]["kind"] }) => {
  if (kind === "activity") {
    return (
      <div className="rounded-[1.8rem] border border-white/70 bg-white/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-cove-700">
              Daily pulse
            </p>
            <p className="mt-1 text-sm text-slate-500">Recent movement with account context</p>
          </div>
          <span className="text-sm font-semibold text-slate-900">8 items</span>
        </div>
        <div className="mt-4 space-y-3">
          {recentActivity.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-500">{item.meta}</p>
              </div>
              <span className="text-sm font-semibold text-slate-900">{item.amount}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "runway") {
    return (
      <div className="rounded-[1.8rem] border border-white/70 bg-white/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex items-end justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-cove-700">
              Budget runway
            </p>
            <p className="mt-1 text-3xl font-display tracking-[-0.04em] text-slate-950">
              14 days covered
            </p>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            3 renewals ahead
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {heroRenewals.map((renewal) => (
            <div key={renewal.name} className="flex items-center justify-between gap-3 text-sm text-slate-700">
              <div>
                <p className="font-medium text-slate-900">{renewal.name}</p>
                <p className="text-xs text-slate-500">Due {renewal.due}</p>
              </div>
              <span className="font-semibold text-slate-900">{renewal.amount}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.8rem] border border-white/70 bg-white/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-cove-700">
            Category pressure
          </p>
          <p className="mt-1 text-sm text-slate-500">What is actually steering the month</p>
        </div>
        <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
          Weekly summary ready
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {showcaseCategories.map((category) => (
          <div key={category.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-900">{category.name}</span>
              <span className="text-slate-500">{category.value}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-[linear-gradient(90deg,#11211e_0%,#2f5e53_100%)]"
                style={{ width: category.width }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CockpitPreview = () => {
  return (
    <div className="relative overflow-hidden rounded-[2.2rem] border border-white/70 bg-white/75 p-4 shadow-[0_45px_140px_rgba(14,31,25,0.18)] backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(77,141,120,0.14),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(18,62,51,0.16),transparent_34%)]" />
      <div className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/70 bg-[linear-gradient(180deg,#fefefe_0%,#f2f5f3_100%)] p-5 lg:p-6">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-cove-700">
              CashCove
            </p>
            <h3 className="mt-2 text-lg font-display tracking-[-0.03em] text-slate-950 lg:text-xl">
              Monthly command view
            </h3>
          </div>
          <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600">
            April 2026 · IST
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.4rem] bg-slate-950 px-4 py-4 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Cash position</p>
            <p className="mt-4 text-3xl font-display tracking-[-0.05em]">₹2.26L</p>
            <p className="mt-2 text-sm text-white/70">Across accounts and reserve buckets</p>
          </div>
          <div className="rounded-[1.4rem] border border-slate-200 bg-white/85 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Budget use</p>
            <p className="mt-4 text-3xl font-display tracking-[-0.05em] text-slate-950">74%</p>
            <p className="mt-2 text-sm text-slate-500">Three categories under watch</p>
          </div>
          <div className="rounded-[1.4rem] border border-slate-200 bg-white/85 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Renewals</p>
            <p className="mt-4 text-3xl font-display tracking-[-0.05em] text-slate-950">5</p>
            <p className="mt-2 text-sm text-slate-500">Due across the next 12 days</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/90 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Category insight</p>
                <p className="text-xs text-slate-500">What is shaping this month</p>
              </div>
              <div className="rounded-full bg-cove-100 px-3 py-1 text-xs font-semibold text-cove-800">
                Clear view
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {showcaseCategories.map((category) => (
                <div key={category.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-900">{category.name}</span>
                    <span className="text-slate-500">{category.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-[linear-gradient(90deg,#10211d_0%,#3b6c5f_100%)]"
                      style={{ width: category.width }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-4 gap-2 rounded-[1.25rem] bg-slate-950/95 p-3">
              {[34, 45, 42, 58, 52, 60, 63, 71].map((height, index) => (
                <div key={index} className="flex items-end justify-center">
                  <div
                    className="w-full rounded-full bg-[linear-gradient(180deg,rgba(162,211,194,0.95)_0%,rgba(76,131,115,0.95)_100%)]"
                    style={{ height: `${height}px` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/90 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Upcoming renewals</p>
                  <p className="text-xs text-slate-500">Bills, subscriptions, and policy due dates</p>
                </div>
                <CalendarDays className="h-4 w-4 text-cove-700" />
              </div>
              <div className="mt-4 space-y-3">
                {heroRenewals.map((renewal) => (
                  <div key={renewal.name} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{renewal.name}</p>
                      <p className="text-xs text-slate-500">Due {renewal.due}</p>
                    </div>
                    <span className="font-semibold text-slate-900">{renewal.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/90 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Balances and reserves</p>
                  <p className="text-xs text-slate-500">Liquid visibility before decisions get made</p>
                </div>
                <Wallet className="h-4 w-4 text-cove-700" />
              </div>
              <div className="mt-4 space-y-3">
                {showcaseAccounts.map((account) => (
                  <div key={account.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">{account.name}</span>
                    <span className="font-semibold text-slate-900">{account.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Landing = () => {
  const authStatus = useAppSelector((state) => state.auth.status);
  const isAuthed = authStatus === "authed";
  const heroRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const visualY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -48]);
  const glowOpacity = useTransform(scrollYProgress, [0, 1], [0.9, 0.4]);

  const heroPrimaryTo = isAuthed ? APP_BASE_PATH : loginPath({ demo: true });
  const heroPrimaryLabel = isAuthed ? "Launch app" : "Try CashCove";
  const navPrimaryTo = isAuthed ? APP_BASE_PATH : loginPath();
  const navPrimaryLabel = isAuthed ? "Launch app" : "Try CashCove";
  const finalPrimaryTo = isAuthed ? APP_BASE_PATH : loginPath({ mode: "signup" });
  const finalPrimaryLabel = isAuthed ? "Open CashCove" : "Try CashCove";

  return (
    <div className="bg-cove-50 text-slate-950">
      <section
        ref={heroRef}
        className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#f9fbf9_0%,#eff4f0_48%,#f8faf8_100%)]"
      >
        <div className="absolute inset-0">
          <div className="absolute inset-x-[-12%] top-[-18rem] h-[34rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(91,134,117,0.22),transparent_60%)] blur-3xl" />
          <div className="absolute right-[-12rem] top-[18%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.08),transparent_62%)] blur-3xl" />
          <div className="absolute bottom-[-12rem] left-[12%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(143,181,166,0.24),transparent_60%)] blur-3xl" />
        </div>

        <header className="absolute inset-x-0 top-0 z-30">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
            <Link to={PUBLIC_HOME_PATH} className="inline-flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-950 text-base font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] sm:h-11 sm:w-11 sm:text-lg">
                ₹
              </span>
              <span className="flex flex-col">
                <span className="font-display text-base tracking-[-0.03em] text-slate-950 sm:text-lg">
                  CashCove
                </span>
                <span className="hidden text-[0.68rem] font-medium uppercase tracking-[0.24em] text-slate-500 sm:inline">
                  Finance cockpit
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
              <a href="#why">Why CashCove</a>
              <a href="#cockpit">How it works</a>
              <a href="#preview">Preview</a>
            </nav>

            <div className="flex items-center gap-3">
              {!isAuthed ? (
                <Link
                  to={loginPath()}
                  className="hidden text-sm font-medium text-slate-600 transition hover:text-slate-950 sm:inline-flex"
                >
                  Sign in
                </Link>
              ) : null}
              <Link
                to={navPrimaryTo}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200/80 bg-white/88 px-3.5 py-2 text-[0.78rem] font-semibold text-slate-950 shadow-[0_12px_36px_rgba(15,23,42,0.08)] backdrop-blur transition hover:-translate-y-0.5 sm:px-4 sm:text-sm"
              >
                {navPrimaryLabel}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <div className="relative mx-auto max-w-[1480px] px-4 pb-12 pt-24 sm:px-6 sm:pb-16 sm:pt-28 lg:px-10 lg:pb-20 lg:pt-32">
          <div className="grid items-center gap-10 md:min-h-[100svh] md:gap-14 xl:grid-cols-[minmax(0,0.64fr)_minmax(0,1.1fr)] xl:gap-8">
            <div className="max-w-[34rem] xl:pr-6">
              <motion.div
                initial={reduceMotion ? undefined : { opacity: 0, y: 22 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="inline-flex items-center gap-3 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-cove-800 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur sm:px-4 sm:py-2 sm:text-[0.72rem]">
                  <span className="h-2 w-2 rounded-full bg-cove-700" />
                  CashCove
                </div>
                <h1 className="mt-5 max-w-[8ch] font-display text-[clamp(2.95rem,15vw,7rem)] leading-[0.92] tracking-[-0.08em] text-slate-950 sm:mt-6 sm:max-w-[10ch] sm:text-[clamp(3.4rem,8vw,7rem)]">
                  <span className="block">See your money</span>
                  <span className="block">clearly.</span>
                </h1>
                <p className="mt-4 max-w-[32rem] text-base leading-7 text-slate-600 sm:mt-6 sm:text-lg sm:leading-8 md:text-xl md:leading-9">
                  A calm command center for spending, budgets, cashflow, renewals,
                  balances, category drift, and recent activity in one polished operating view.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
                  <Link
                    to={heroPrimaryTo}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-slate-950 px-6 py-3.5 text-[0.95rem] font-semibold tracking-[0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:bg-slate-900 sm:min-h-11 sm:w-auto sm:px-6 sm:py-3 sm:text-sm"
                  >
                    {heroPrimaryLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="#cockpit"
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white/82 px-6 py-3.5 text-[0.95rem] font-semibold text-slate-700 backdrop-blur transition hover:-translate-y-0.5 hover:text-slate-950 sm:min-h-11 sm:w-auto sm:px-6 sm:py-3 sm:text-sm"
                  >
                    See how it works
                  </a>
                </div>
                <div className="mt-6 flex flex-col items-start gap-2 text-sm text-slate-500 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cove-700" />
                    Budgets, renewals, and balances together
                  </span>
                  <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-cove-700" />
                    Calm, private, practical
                  </span>
                </div>
              </motion.div>
            </div>

            <motion.div
              style={{ y: visualY }}
              className="relative mx-auto w-full max-w-[36rem] xl:max-w-none xl:pl-4"
              initial={reduceMotion ? undefined : { opacity: 0, scale: 0.98, y: 24 }}
              animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                style={{ opacity: glowOpacity }}
                className="absolute inset-x-[8%] top-[8%] h-[72%] rounded-full bg-[radial-gradient(circle_at_center,rgba(74,119,102,0.34),transparent_62%)] blur-[72px]"
              />
              <motion.div
                className="relative transform-gpu will-change-transform"
                whileHover={reduceMotion ? undefined : { y: -6, rotate: -1.2, scale: 1.008 }}
                transition={heroPreviewHoverTransition}
              >
                <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/68 p-3 shadow-[0_48px_140px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:rounded-[2.4rem] sm:p-4 lg:p-5">
                  <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.72),rgba(255,255,255,0.22))]" />
                  <div className="relative overflow-hidden rounded-[1.65rem] border border-slate-200/80 bg-[linear-gradient(180deg,#fdfefe_0%,#eef3f0_100%)] p-4 sm:rounded-[2rem] sm:p-5 lg:p-6">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-cove-700">
                        Monthly snapshot
                      </p>
                      <p className="mt-2 text-lg font-display tracking-[-0.03em] text-slate-950">
                        April command view
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-[0.68rem] font-semibold text-slate-500 shadow-[0_8px_20px_rgba(15,23,42,0.04)] sm:text-xs">
                      IST · INR
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[1.45rem] bg-slate-950 px-4 py-4 text-white">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/60">Available cash</p>
                      <p className="mt-4 text-3xl font-display tracking-[-0.05em]">₹2.26L</p>
                      <p className="mt-2 text-sm text-white/70">Across accounts and reserves</p>
                    </div>
                    <div className="rounded-[1.45rem] border border-slate-200 bg-white/90 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Budget pressure</p>
                      <p className="mt-4 text-3xl font-display tracking-[-0.05em] text-slate-950">74%</p>
                      <p className="mt-2 text-sm text-slate-500">3 categories nearing cap</p>
                    </div>
                    <div className="rounded-[1.45rem] border border-slate-200 bg-white/90 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Due soon</p>
                      <p className="mt-4 text-3xl font-display tracking-[-0.05em] text-slate-950">5</p>
                      <p className="mt-2 text-sm text-slate-500">Renewals inside 12 days</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/92 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Account balances</p>
                          <p className="text-xs text-slate-500">What is liquid right now</p>
                        </div>
                        <Wallet className="h-4 w-4 text-cove-700" />
                      </div>
                      <div className="mt-4 space-y-3">
                        {balanceRail.map((account) => (
                          <div key={account.name} className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-slate-600">{account.name}</span>
                            <span className="font-semibold text-slate-900">{account.amount}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-5 rounded-[1.35rem] bg-slate-950 px-4 py-4 text-white">
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-white/55">
                          <span>Cashflow pulse</span>
                          <span>Next 14 days</span>
                        </div>
                        <div className="mt-4 grid grid-cols-7 gap-2">
                          {[52, 68, 46, 75, 62, 58, 84].map((height, index) => (
                            <div key={index} className="flex items-end justify-center">
                              <div
                                className="w-full rounded-full bg-[linear-gradient(180deg,rgba(202,237,224,0.95),rgba(67,125,108,0.95))]"
                                style={{ height: `${height}px` }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/92 p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Renewals and obligations</p>
                            <p className="text-xs text-slate-500">Bills, subscriptions, and policies</p>
                          </div>
                          <CalendarDays className="h-4 w-4 text-cove-700" />
                        </div>
                        <div className="mt-4 space-y-3">
                          {heroRenewals.map((renewal) => (
                            <div key={renewal.name} className="flex items-center justify-between gap-3 text-sm">
                              <div>
                                <p className="font-medium text-slate-900">{renewal.name}</p>
                                <p className="text-xs text-slate-500">Due {renewal.due}</p>
                              </div>
                              <span className="font-semibold text-slate-900">{renewal.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/92 p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Daily pulse</p>
                            <p className="text-xs text-slate-500">Recent activity across the ledger</p>
                          </div>
                          <BellRing className="h-4 w-4 text-cove-700" />
                        </div>
                        <div className="mt-4 space-y-3">
                          {recentActivity.map((item) => (
                            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                              <div>
                                <p className="font-medium text-slate-900">{item.label}</p>
                                <p className="text-xs text-slate-500">{item.meta}</p>
                              </div>
                              <span className="font-semibold text-slate-900">{item.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="why" className="border-t border-slate-200/80 bg-white/92">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
          <Reveal className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
            <div className="max-w-sm">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cove-700">
                Why CashCove
              </p>
              <h2 className="mt-4 font-display text-3xl tracking-[-0.05em] text-slate-950 md:text-4xl">
                Personal finance, run like an operating system.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
                CashCove is not another noisy expense tracker. It is a calm surface for
                understanding what matters, what is due, and what needs attention next.
              </p>
            </div>

            <div className="border-t border-slate-200/80 pt-8 md:border-t-0 md:pt-0">
              {valuePoints.map((point, index) => {
                const Icon = point.icon;
                return (
                  <div
                    key={point.title}
                    className={`grid gap-4 py-5 sm:grid-cols-[3rem_minmax(0,1fr)] sm:items-start ${index > 0 ? "border-t border-slate-200/80" : ""}`}
                  >
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cove-100 text-cove-800">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-xl tracking-[-0.03em] text-slate-950 sm:text-[1.35rem]">
                        {point.title}
                      </h3>
                      <p className="mt-2 max-w-[34rem] text-sm leading-7 text-slate-600 md:text-[0.98rem]">
                        {point.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="cockpit" className="bg-[linear-gradient(180deg,#f6f9f7_0%,#edf3ef_100%)]">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:grid lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:px-10 lg:py-28">
          <Reveal className="self-start lg:sticky lg:top-24">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cove-700">
              Finance cockpit
            </p>
            <h2 className="mt-4 max-w-[12ch] font-display text-3xl tracking-[-0.05em] text-slate-950 md:text-5xl">
              Clarity first. Then control.
            </h2>
            <p className="mt-5 max-w-[30rem] text-base leading-8 text-slate-600 md:text-lg">
              The product is built around one idea: the month should feel legible. Each view
              exists to help you observe, operate, and decide without spreadsheet sprawl.
            </p>
          </Reveal>

          <div className="mt-12 space-y-14 lg:mt-0">
            {storySections.map((section, index) => (
              <Reveal
                key={section.title}
                delay={index * 0.06}
                className="border-t border-slate-200/80 pt-8 first:border-t-0 first:pt-0"
              >
                <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
                  <div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cove-700">
                      {section.eyebrow}
                    </p>
                    <h3 className="mt-3 max-w-[22ch] text-2xl tracking-[-0.04em] text-slate-950 md:text-[2rem]">
                      {section.title}
                    </h3>
                    <p className="mt-4 max-w-[32rem] text-base leading-8 text-slate-600">
                      {section.description}
                    </p>
                  </div>
                  <StoryPanel kind={section.kind} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="preview" className="bg-white">
        <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10 lg:py-28">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cove-700">
              Product preview
            </p>
            <h2 className="mt-4 font-display text-3xl tracking-[-0.05em] text-slate-950 md:text-5xl">
              A polished operational view, not a pile of disconnected finance widgets.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
              Account balances, category pressure, renewals, reserves, and cashflow sit together
              because that is how real monthly decisions actually get made.
            </p>
          </Reveal>

          <Reveal delay={0.08} className="mt-12 lg:mt-16">
            <div className="relative mx-auto max-w-[1200px]">
              <div className="absolute inset-x-[12%] top-[8%] h-[78%] rounded-full bg-[radial-gradient(circle_at_center,rgba(96,141,123,0.22),transparent_60%)] blur-[80px]" />
              <CockpitPreview />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-[linear-gradient(180deg,#f8faf9_0%,#eef3ef_100%)]">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-10 lg:py-24">
          <Reveal>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cove-700">
              Emotional payoff
            </p>
            <h2 className="mt-4 max-w-[12ch] font-display text-3xl tracking-[-0.05em] text-slate-950 md:text-5xl">
              When the month gets noisy, CashCove stays calm.
            </h2>
            <p className="mt-5 max-w-[34rem] text-base leading-8 text-slate-600 md:text-lg">
              It is for people who are tired of guessing where the money went, chasing renewals,
              and assembling clarity from three apps, two notes, and a spreadsheet that only makes sense on Sundays.
            </p>
          </Reveal>

          <div className="mt-10 space-y-6 lg:mt-0">
            {trustPoints.map((point, index) => {
              const Icon = point.icon;
              return (
                <Reveal
                  key={point.title}
                  delay={index * 0.05}
                  className="flex gap-4 border-t border-slate-200/80 pt-6 first:border-t-0 first:pt-0"
                >
                  <span className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-cove-800 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-xl tracking-[-0.03em] text-slate-950">{point.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600 md:text-[0.96rem]">
                      {point.description}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-cove-950 text-white">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center lg:px-10 lg:py-24">
          <Reveal>
            <span className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-white/70">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              CashCove
            </span>
            <h2 className="mx-auto mt-6 max-w-[12ch] font-display text-4xl tracking-[-0.06em] text-white md:text-6xl">
              A calmer way to run your money.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/68 md:text-lg">
              Try the cockpit, inspect the product in motion, and stop managing your month with guesswork.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to={finalPrimaryTo}
                className="inline-flex min-h-12 w-full max-w-[18rem] items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3.5 text-[0.95rem] font-semibold tracking-[0.01em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition hover:-translate-y-0.5 sm:min-h-11 sm:w-auto sm:max-w-none sm:px-6 sm:py-3 sm:text-sm"
              >
                {finalPrimaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {!isAuthed ? (
                <Link
                  to={loginPath({ demo: true })}
                  className="inline-flex min-h-12 w-full max-w-[18rem] items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/16 bg-white/6 px-6 py-3.5 text-[0.95rem] font-semibold text-white/88 transition hover:-translate-y-0.5 hover:bg-white/10 sm:min-h-11 sm:w-auto sm:max-w-none sm:px-6 sm:py-3 sm:text-sm"
                >
                  Try the demo
                </Link>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};
