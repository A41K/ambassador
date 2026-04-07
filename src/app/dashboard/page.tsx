import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Navbar } from "@/components/navbar";
import {
  APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS,
  isAcceptedApplicationStatus,
  isPendingApplicationStatus,
  isRejectedApplicationStatus,
  isRejectedPermanentlyApplicationStatus,
} from "@/lib/applications";
import sql from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";
import { getSession } from "@/lib/session";
import { DevStateSwitcher } from "./DevStateSwitcher";

const isDev = process.env.NODE_ENV === "development";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ devState?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  await ensureSchema();
  const [t, locale, { devState }] = await Promise.all([
    getTranslations(),
    getLocale(),
    searchParams,
  ]);

  const [[application], [user]] = await Promise.all([
    sql`
      SELECT id, status, name, created_at
      FROM applications WHERE user_id = ${session.sub}
      ORDER BY created_at DESC LIMIT 1
    `,
    sql`
      SELECT balance_cents, is_admin, ambassador_region FROM users WHERE id = ${session.sub}
    `,
  ]);

  const fakeDate = new Date().toISOString();
  const activeDevState = isDev ? (devState ?? "apply") : null;

  function renderState() {
    if (activeDevState === "ineligible") return <IneligibleRegion t={t} />;
    if (activeDevState === "pending-checks") return <PendingAutomaticChecksApplication t={t} />;
    if (activeDevState === "pending") return <PendingApplication createdAt={fakeDate} dateFormatLocale={locale} t={t} />;
    if (activeDevState === "approved") return <ApprovedApplication t={t} />;
    if (activeDevState === "rejected") return <RejectedApplication t={t} />;
    if (activeDevState === "banned") return <RejectedPermanentlyApplication t={t} />;
    if (activeDevState === "apply") return <NoApplication t={t} />;

    // Real data
    if (!application && user?.ambassador_region === "Other") return <IneligibleRegion t={t} />;
    if (!application) return <NoApplication t={t} />;
    if (application.status === APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS) return <PendingAutomaticChecksApplication t={t} />;
    if (isPendingApplicationStatus(application.status)) return <PendingApplication createdAt={application.created_at} dateFormatLocale={locale} t={t} />;
    if (isAcceptedApplicationStatus(application.status)) return <ApprovedApplication t={t} />;
    if (isRejectedApplicationStatus(application.status)) return <RejectedApplication t={t} />;
    if (isRejectedPermanentlyApplicationStatus(application.status)) return <RejectedPermanentlyApplication t={t} />;
    return null;
  }

  return (
    <main className="page-shell">
      <Navbar isAdmin={Boolean(user?.is_admin)} balanceCents={user?.balance_cents ?? 0} />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-4xl text-white">
          {t("dashboard.heading", { name: session.displayName })}
        </h1>
        <hr className="mt-6 border-white/10" />
        <div className="mt-8">{renderState()}</div>
      </div>
      {isDev && <DevStateSwitcher current={activeDevState ?? "apply"} />}
    </main>
  );
}

function IneligibleRegion({
  t,
}: {
  t: (key: string, values?: Record<string, number | string>) => string;
}) {
  return (
    <div>
      <div className="mb-1 text-sm tracking-widest text-primary">
        {t("dashboard.ineligible-region.eyebrow")}
      </div>
      <h2 className="font-sub text-3xl text-white">{t("dashboard.ineligible-region.title")}</h2>
      <p className="mt-3 text-lg leading-relaxed text-white">
        {t("dashboard.ineligible-region.body")}
      </p>
      <a
        href="/settings"
        className="mt-6 inline-flex h-12 items-center rounded-xl bg-primary px-8 text-lg tracking-wide text-white transition-opacity hover:opacity-80"
      >
        {t("dashboard.ineligible-region.cta")}
      </a>
    </div>
  );
}

function NoApplication({
  t,
}: {
  t: (key: string, values?: Record<string, number | string>) => string;
}) {
  return (
    <div>
      <div className="mb-1 text-sm tracking-widest text-primary">
        {t("dashboard.no-application.eyebrow")}
      </div>
      <h2 className="font-sub text-3xl text-white">{t("dashboard.no-application.title")}</h2>
      <p className="mt-3 text-lg leading-relaxed text-white">
        {t("dashboard.no-application.body")}
      </p>
      <a
        href="/form"
        className="mt-6 inline-flex h-12 items-center rounded-xl bg-primary px-8 text-lg tracking-wide text-white transition-opacity hover:opacity-80"
      >
        {t("dashboard.no-application.cta")}
      </a>
    </div>
  );
}

function PendingApplication({
  createdAt,
  dateFormatLocale,
  t,
}: {
  createdAt: string;
  dateFormatLocale: string;
  t: (key: string, values?: Record<string, number | string>) => string;
}) {
  const submittedDate = new Date(createdAt).toLocaleDateString(dateFormatLocale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <div className="mb-1 text-sm tracking-widest text-accent">
        {t("dashboard.pending.eyebrow")}
      </div>
      <h2 className="font-sub text-3xl text-white">{t("dashboard.pending.title")}</h2>
      <p className="mt-3 text-lg leading-relaxed text-white">
        {t("dashboard.pending.body", { date: submittedDate })}
      </p>
      <div className="mt-6 flex items-center gap-3">
        <div className="h-3 w-3 animate-pulse rounded-full bg-accent" />
        <span className="text-base tracking-wide text-accent">{t("dashboard.pending.status")}</span>
      </div>
    </div>
  );
}

function PendingAutomaticChecksApplication({
  t,
}: {
  t: (key: string, values?: Record<string, number | string>) => string;
}) {
  return (
    <div>
      <div className="mb-1 text-sm tracking-widest text-accent">
        {t("dashboard.pending-automatic-checks.eyebrow")}
      </div>
      <h2 className="font-sub text-3xl text-white">
        {t("dashboard.pending-automatic-checks.title")}
      </h2>
      <p className="mt-3 text-lg leading-relaxed text-white">
        {t("dashboard.pending-automatic-checks.body")}
      </p>
      <a
        href="https://auth.hackclub.com"
        className="mt-6 inline-flex h-12 items-center rounded-xl bg-primary px-8 text-lg text-white transition-opacity hover:opacity-80"
      >
        {t("dashboard.pending-automatic-checks.cta")}
      </a>
    </div>
  );
}

function ApprovedApplication({
  t,
}: {
  t: (key: string, values?: Record<string, number | string>) => string;
}) {
  return (
    <div>
      <h2 className="font-sub text-3xl text-white">{t("dashboard.approved.title")}</h2>
      <p className="mt-3 text-lg leading-relaxed text-white">
        {t("dashboard.approved.body")}
      </p>
      <div className="mt-6 flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-accent" />
        <span className="text-base tracking-wide text-accent">{t("dashboard.approved.status")}</span>
      </div>
      <hr className="mt-6 border-white/10" />
    </div>
  );
}

function RejectedApplication({
  t,
}: {
  t: (key: string, values?: Record<string, number | string>) => string;
}) {
  return (
    <div>
      <div className="mb-1 text-sm tracking-widest text-primary">
        {t("dashboard.rejected.eyebrow")}
      </div>
      <h2 className="font-sub text-3xl text-white">{t("dashboard.rejected.title")}</h2>
      <p className="mt-3 text-lg leading-relaxed text-white">
        {t("dashboard.rejected.body")}
      </p>
    </div>
  );
}

function RejectedPermanentlyApplication({
  t,
}: {
  t: (key: string, values?: Record<string, number | string>) => string;
}) {
  return (
    <div>
      <div className="mb-1 text-sm tracking-widest text-primary">
        {t("dashboard.rejected-permanently.eyebrow")}
      </div>
      <h2 className="font-sub text-3xl text-white">{t("dashboard.rejected-permanently.title")}</h2>
      <p className="mt-3 text-lg leading-relaxed text-white">
        {t("dashboard.rejected-permanently.body")}
      </p>
    </div>
  );
}
