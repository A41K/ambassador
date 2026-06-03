import { cache } from "react";

import sql from "@/lib/database/client";
import { getAmbassadorOnboardingStatus } from "@/lib/ambassadors/airtable";
import { isAcceptedApplicationStatus } from "@/lib/applications/status";
import { isUserManualDashboardState } from "@/lib/user-dashboard-state";

export type PosterAccessState = {
  balance_cents?: number | null;
  is_admin?: boolean | null;
  manual_dashboard_state?: string | null;
  latest_application_status?: string | null;
  latest_application_airtable_record_id?: string | null;
  latest_application_airtable_payload?: unknown;
  country_code?: string | null;
  ambassador_region?: string | null;
  is_onboarding_complete: boolean;
};

// cache() so the (nav) layout and the page it wraps share one lookup per request.
export const getPosterAccessState = cache(async (userId: string): Promise<PosterAccessState | null> => {
  const user = (await sql<Omit<PosterAccessState, "is_onboarding_complete">[]>`
    SELECT
      users.balance_cents,
      users.is_admin,
      users.manual_dashboard_state,
      users.country_code,
      users.ambassador_region,
      latest_application.status AS latest_application_status,
      latest_application.airtable_record_id AS latest_application_airtable_record_id,
      latest_application.airtable_payload AS latest_application_airtable_payload
    FROM users
    LEFT JOIN LATERAL (
      SELECT status, airtable_record_id, airtable_payload
      FROM applications
      WHERE user_id = users.id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) latest_application ON true
    WHERE users.id = ${userId}
    LIMIT 1
  `).at(0) ?? null;

  if (user === null) {
    return null;
  }

  if (!hasApprovedAmbassadorStatus({
    latestApplicationStatus: user.latest_application_status ?? null,
    manualDashboardState: user.manual_dashboard_state ?? null,
  })) {
    return { ...user, is_onboarding_complete: false };
  }

  const onboardingStatus = await getAmbassadorOnboardingStatus({
    applicationAirtableRecordId: user.latest_application_airtable_record_id ?? null,
    applicationAirtablePayload: user.latest_application_airtable_payload ?? null,
  });

  return {
    ...user,
    is_onboarding_complete: onboardingStatus.isOnboardingComplete,
  };
});

export function hasApprovedAmbassadorStatus(input: {
  latestApplicationStatus?: string | null;
  manualDashboardState?: string | null;
} | null | undefined) {
  const manualDashboardState = isUserManualDashboardState(input?.manualDashboardState)
    ? input.manualDashboardState
    : null;

  return (
    manualDashboardState === "approved" ||
    isAcceptedApplicationStatus(input?.latestApplicationStatus)
  );
}

export function canAccessPosters(input: {
  latestApplicationStatus?: string | null;
  manualDashboardState?: string | null;
  isOnboardingComplete?: boolean;
  isAdmin?: boolean;
} | null | undefined) {
  if (input?.isAdmin === true) {
    return true;
  }

  return hasApprovedAmbassadorStatus(input) && input?.isOnboardingComplete === true;
}
