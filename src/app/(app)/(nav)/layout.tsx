import { redirect } from "next/navigation";

import { Navbar } from "@/components/navbar";
import { canAccessPosters, getPosterAccessState } from "@/lib/posters/access";
import { getEffectiveSafeguards } from "@/lib/safeguards";
import { getSession } from "@/lib/session";
import { canAccessStardanceReferrals } from "@/lib/stardance-referrals";

/**
 * The one place the ambassador-facing navbar is rendered and its props are
 * computed. Pages under (nav) only render their own content; the admin
 * section keeps its own layout because its navbar reflects the acting admin
 * (getActorSession), not the impersonated user.
 */
export default async function NavLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const [user, safeguards] = await Promise.all([
    getPosterAccessState(session.sub),
    getEffectiveSafeguards(session.sub),
  ]);

  const canAccessAdmin =
    Boolean(session.impersonator) || Boolean(user?.is_admin ?? session.isAdmin);
  const access = {
    latestApplicationStatus: user?.latest_application_status ?? null,
    manualDashboardState: user?.manual_dashboard_state ?? null,
    isOnboardingComplete: user?.is_onboarding_complete ?? false,
    isAdmin: canAccessAdmin,
  };

  return (
    <main className="page-shell">
      <Navbar
        isAdmin={canAccessAdmin}
        balanceCents={user?.balance_cents ?? 0}
        showPostersLink={safeguards.postersEnabled && canAccessPosters(access)}
        showReferralsLink={safeguards.referralsEnabled && canAccessStardanceReferrals(access)}
      />
      {children}
    </main>
  );
}
