import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/navbar";
import sql from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";
import { getSession } from "@/lib/session";

export default async function PostersPage() {
  const session = await getSession();
  if (!session) redirect("/");
  await ensureSchema();
  const t = await getTranslations();

  const [user] = await sql`
    SELECT balance_cents, is_admin FROM users WHERE id = ${session.sub}
  `;

  return (
    <main className="page-shell">
      <Navbar isAdmin={Boolean(user?.is_admin)} balanceCents={user?.balance_cents ?? 0} />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-4xl text-white">{t("posters.heading")}</h1>
        <hr className="mt-6 border-white/10" />
      </div>
    </main>
  );
}
