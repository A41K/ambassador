import type { AdminActionEvent } from "@/lib/admin-action-events";

type AuditEventLike = {
  action: string;
  metadata: Record<string, unknown>;
};

type DetailRow = {
  label: string;
  value: string | null;
};

const EVENT_LABELS: Record<AdminActionEvent, string> = {
  application_deleted: "Application deleted",
  application_tshirt_sent_updated: "Application T-shirt status updated",
  hcb_credentials_reauthorized: "HCB credentials reauthorized",
  user_admin_password_rejected: "Superuser password rejected",
  user_demoted_from_admin: "User removed as admin",
  user_hcb_grant_linked: "HCB grant linked",
  user_hcb_grant_provisioned: "HCB grant provisioned",
  user_hcb_grant_unlinked: "HCB grant unlinked",
  user_impersonation_started: "Impersonation started",
  user_impersonation_stopped: "Impersonation stopped",
  user_manual_dashboard_state_updated: "Dashboard state updated",
  user_posters_enabled_updated: "Posters access updated",
  user_promoted_to_admin: "User made admin",
};

const METADATA_LABELS: Record<string, string> = {
  amountCents: "Amount",
  applicationId: "Application",
  attemptedAction: "Attempted action",
  authorizedHcbUserEmail: "Authorized HCB email",
  authorizedHcbUserId: "Authorized HCB user",
  authorizedHcbUserName: "Authorized HCB name",
  expiresAt: "Expires",
  grantId: "Grant",
  impersonationStartedAt: "Impersonation started",
  nextIsAdmin: "Next admin access",
  nextPostersEnabled: "Next posters access",
  nextSent: "Next T-shirt status",
  nextState: "Next dashboard state",
  organizationId: "Organization",
  previousGrantId: "Previous grant",
  previousIsAdmin: "Previous admin access",
  previousOrganizationId: "Previous organization",
  previousPostersEnabled: "Previous posters access",
  previousSent: "Previous T-shirt status",
  previousState: "Previous dashboard state",
  purpose: "Purpose",
  scopes: "Scopes",
  source: "Source",
  status: "Application status",
  targetIsAdmin: "Target was admin",
};

const ACTION_LABELS: Record<string, string> = {
  demote_admin: "Remove admin access",
  promote_admin: "Make admin",
};

export function formatEventType(event: string): string {
  if (isKnownAdminActionEvent(event)) {
    return EVENT_LABELS[event];
  }

  return event
    .split("_")
    .filter(Boolean)
    .map((word, index) => index === 0 ? word : word.toLowerCase())
    .join(" ");
}

export function formatAuditEventSummary(event: AuditEventLike): string {
  const metadata = event.metadata ?? {};

  switch (event.action) {
    case "application_deleted":
      return joinSentenceParts(
        `Deleted application ${formatMetadataValue(metadata.applicationId)}.`,
        metadata.status ? `It was ${formatMetadataValue(metadata.status)}.` : null,
      );
    case "application_tshirt_sent_updated":
      return `Changed T-shirt status from ${formatBooleanState(metadata.previousSent, "sent", "not sent")} to ${formatBooleanState(metadata.nextSent, "sent", "not sent")}.`;
    case "hcb_credentials_reauthorized":
      return joinSentenceParts(
        `Reauthorized HCB credentials for ${formatMetadataValue(metadata.authorizedHcbUserName ?? metadata.authorizedHcbUserEmail ?? metadata.authorizedHcbUserId)}.`,
        metadata.expiresAt ? `Expires ${formatMetadataValue(metadata.expiresAt)}.` : null,
      );
    case "user_admin_password_rejected":
      return `Rejected a superuser password attempt for ${formatAction(metadata.attemptedAction)}.`;
    case "user_demoted_from_admin":
      return "Removed admin access from this user.";
    case "user_hcb_grant_linked":
      return `Linked HCB grant ${formatMetadataValue(metadata.grantId)}.`;
    case "user_hcb_grant_provisioned":
      return `Provisioned HCB grant ${formatMetadataValue(metadata.grantId)}.`;
    case "user_hcb_grant_unlinked":
      return `Unlinked HCB grant ${formatMetadataValue(metadata.previousGrantId)}.`;
    case "user_impersonation_started":
      return `Started impersonating a ${formatBooleanState(metadata.targetIsAdmin, "admin", "non-admin")} user.`;
    case "user_impersonation_stopped":
      return metadata.impersonationStartedAt
        ? `Stopped impersonation that started ${formatMetadataValue(metadata.impersonationStartedAt)}.`
        : "Stopped impersonating this user.";
    case "user_manual_dashboard_state_updated":
      return `Changed dashboard state from ${formatNullableState(metadata.previousState)} to ${formatNullableState(metadata.nextState)}.`;
    case "user_posters_enabled_updated":
      return `Changed posters access from ${formatBooleanState(metadata.previousPostersEnabled, "enabled", "disabled")} to ${formatBooleanState(metadata.nextPostersEnabled, "enabled", "disabled")}.`;
    case "user_promoted_to_admin":
      return "Granted admin access to this user.";
    default:
      return getFallbackSummary(metadata);
  }
}

export function getAuditEventDetailRows(metadata: Record<string, unknown>): DetailRow[] {
  return Object.entries(metadata)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      label: METADATA_LABELS[key] ?? formatMetadataKey(key),
      value: formatMetadataValue(value),
    }));
}

function isKnownAdminActionEvent(event: string): event is AdminActionEvent {
  return Object.hasOwn(EVENT_LABELS, event);
}

function formatBooleanState(value: unknown, trueLabel: string, falseLabel: string) {
  return value === true ? trueLabel : falseLabel;
}

function formatNullableState(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "not set";
  }

  return formatMetadataValue(value);
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "not set";
  }

  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString("en-US") : String(value);
  }

  if (typeof value === "string") {
    return ACTION_LABELS[value] ?? value.replaceAll("_", " ");
  }

  if (Array.isArray(value)) {
    return value.length > 0
      ? value.map((item) => formatMetadataValue(item)).join(", ")
      : "none";
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${formatMetadataKey(key)}: ${formatMetadataValue(nestedValue)}`)
      .join(", ");
  }

  return String(value);
}

function formatMetadataKey(key: string) {
  return key
    .replaceAll("_", " ")
    .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatAction(value: unknown) {
  return typeof value === "string"
    ? ACTION_LABELS[value] ?? formatMetadataValue(value)
    : "this admin action";
}

function getFallbackSummary(metadata: Record<string, unknown>) {
  const rows = getAuditEventDetailRows(metadata);

  if (rows.length === 0) {
    return "No additional details recorded.";
  }

  return rows.map((row) => `${row.label}: ${row.value ?? "not set"}`).join("; ");
}

function joinSentenceParts(...parts: Array<string | null>) {
  return parts.filter((part): part is string => part !== null && part.trim() !== "").join(" ");
}
