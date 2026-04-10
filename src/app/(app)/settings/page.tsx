import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/navbar";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import sql from "@/lib/database/client";
import { getSession } from "@/lib/session";
import { ensureUserAddressSchema } from "@/lib/database/user-address-schema";

import SettingsClient from "./SettingsClient";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("settings.metadata.title");
}

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const t = await getTranslations();
  await ensureUserAddressSchema();

  const [user] = await sql`
    SELECT
      display_name, email, hca_first_name, hca_last_name,
      slack_id, slack_name, verification_status,
      ambassador_region, hca_country, country_name, country_code,
      balance_cents, is_admin
    FROM users WHERE id = ${session.sub}
  `;
  const canAccessAdmin = Boolean(session.impersonator) || Boolean(user?.is_admin ?? session.isAdmin);

  return (
    <main className="page-shell">
      <Navbar isAdmin={canAccessAdmin} balanceCents={user?.balance_cents ?? 0} />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-4xl text-white">{t("settings.heading")}</h1>
        <hr className="mt-6 border-white/10" />

        <SettingsClient
          displayName={user?.display_name ?? session.displayName}
          email={user?.email ?? session.email ?? ""}
          firstName={user?.hca_first_name ?? ""}
          lastName={user?.hca_last_name ?? ""}
          slackName={user?.slack_name ?? ""}
          verificationStatus={user?.verification_status ?? ""}
          currentRegion={user?.ambassador_region ?? null}
          detectedRegions={[
            user?.hca_country ?? null,
            user?.country_name ?? null,
            user?.country_code ?? null,
          ]}
        />
      </div>
    </main>
  );
}
