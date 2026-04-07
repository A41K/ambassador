const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 15_000;

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

function getSyncUrl() {
  const explicitUrl = process.env.DEV_AIRTABLE_SYNC_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const baseUrl = process.env.CURRENT_DOMAIN?.trim() || "http://localhost:7171";

  return new URL("/api/cron/applications/sync", baseUrl).toString();
}

if (process.env.NODE_ENV === "production") {
  console.error("[airtable-sync-loop] Refusing to run in production.");
  process.exit(1);
}

const intervalMs = parsePositiveInt(process.env.DEV_AIRTABLE_SYNC_INTERVAL_MS, DEFAULT_INTERVAL_MS);
const timeoutMs = parsePositiveInt(process.env.DEV_AIRTABLE_SYNC_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
const syncUrl = getSyncUrl();
const runOnce = process.argv.includes("--once");

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
        "user-agent": "dev-airtable-sync-loop/1.0",
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
        `[airtable-sync-loop] ${response.status} (${elapsedMs}ms) ${typeof payload === "string" ? payload : JSON.stringify(payload)}`,
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

      console.log(`[airtable-sync-loop] ok (${elapsedMs}ms) ${summaryParts.join(" ")}`);
      return;
    }

    console.log(`[airtable-sync-loop] ok (${elapsedMs}ms)`);
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    console.error(`[airtable-sync-loop] failed (${elapsedMs}ms) ${formatError(error)}`);
  } finally {
    inFlight = false;
  }
}

function shutdown(signal) {
  if (timer) clearInterval(timer);
  console.log(`[airtable-sync-loop] stopping (${signal})`);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

await runSync();

if (runOnce) {
  process.exit(0);
}

console.log(`[airtable-sync-loop] running every ${Math.round(intervalMs / 1000)}s -> ${syncUrl}`);
timer = setInterval(() => {
  void runSync();
}, intervalMs);
