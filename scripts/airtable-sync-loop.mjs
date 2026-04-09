const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 15_000;

const LEGACY_ENV_KEYS = {
  authToken: "DEV_AIRTABLE_SYNC_AUTH_TOKEN",
  intervalMs: "DEV_AIRTABLE_SYNC_INTERVAL_MS",
  timeoutMs: "DEV_AIRTABLE_SYNC_TIMEOUT_MS",
  url: "DEV_AIRTABLE_SYNC_URL",
};

function parsePositiveInt(value, fallback) {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;

  return parsed;
}

function formatError(error) {
  if (error instanceof Error) return error.message;

  return String(error);
}

function readStringEnv(name, legacyName) {
  const value = process.env[name]?.trim();
  if (value) return value;

  const legacyValue = legacyName ? process.env[legacyName]?.trim() : "";
  if (legacyValue) {
    console.warn(`[airtable-sync] ${legacyName} is deprecated. Use ${name} instead.`);
    return legacyValue;
  }

  return "";
}

function readPositiveIntEnv(name, fallback, legacyName) {
  const value = readStringEnv(name, legacyName);
  return parsePositiveInt(value, fallback);
}

function getSyncUrl() {
  const explicitUrl = readStringEnv("AIRTABLE_SYNC_URL", LEGACY_ENV_KEYS.url);
  if (explicitUrl) return explicitUrl;

  const baseUrl = process.env.CURRENT_DOMAIN?.trim() || "http://localhost:7171";

  return new URL("/api/cron/applications/sync", baseUrl).toString();
}

function getAuthToken() {
  return (
    readStringEnv("AIRTABLE_SYNC_AUTH_TOKEN", LEGACY_ENV_KEYS.authToken) ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

const intervalMs = readPositiveIntEnv("AIRTABLE_SYNC_INTERVAL_MS", DEFAULT_INTERVAL_MS, LEGACY_ENV_KEYS.intervalMs);
const timeoutMs = readPositiveIntEnv("AIRTABLE_SYNC_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, LEGACY_ENV_KEYS.timeoutMs);
const syncUrl = getSyncUrl();
const authToken = getAuthToken();
const runOnce = process.argv.includes("--once");

if (process.env.NODE_ENV === "production" && !authToken) {
  console.error("[airtable-sync] CRON_SECRET or AIRTABLE_SYNC_AUTH_TOKEN is required in production.");
  process.exit(1);
}

let inFlight = false;
let timer = null;

async function runSync() {
  if (inFlight) return;
  inFlight = true;

  const startedAt = Date.now();

  try {
    const response = await fetch(syncUrl, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        "user-agent": "airtable-sync-loop/1.0",
      },
      cache: "no-store",
    });

    const elapsedMs = Date.now() - startedAt;
    const bodyText = await response.text();

    let payload = null;
    if (bodyText) {
      try {
        payload = JSON.parse(bodyText);
      } catch {
        payload = bodyText;
      }
    }

    if (!response.ok) {
      console.error(
        `[airtable-sync] ${response.status} (${elapsedMs}ms) ${typeof payload === "string" ? payload : JSON.stringify(payload)}`,
      );
      return;
    }

    if (payload && typeof payload === "object") {
      const summaryParts = [
        `processed=${payload.processed ?? "?"}`,
        `inserted=${payload.inserted ?? "?"}`,
        `updated=${payload.updated ?? "?"}`,
        `unmatched=${payload.unmatchedApplications ?? "?"}`,
        `matchedUsers=${payload.matchedUsers ?? "?"}`,
      ];

      console.log(`[airtable-sync] ok (${elapsedMs}ms) ${summaryParts.join(" ")}`);
      return;
    }

    console.log(`[airtable-sync] ok (${elapsedMs}ms)`);
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    console.error(`[airtable-sync] failed (${elapsedMs}ms) ${formatError(error)}`);
  } finally {
    inFlight = false;
  }
}

function shutdown(signal) {
  if (timer) clearInterval(timer);
  console.log(`[airtable-sync] stopping (${signal})`);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

await runSync();

if (runOnce) {
  process.exit(0);
}

console.log(`[airtable-sync] running every ${Math.round(intervalMs / 1000)}s -> ${syncUrl}`);
timer = setInterval(() => {
  void runSync();
}, intervalMs);
