import { ensureSchema } from "@/lib/database/ensure-schema";
import { syncAllStardanceRsvpReferrals } from "@/lib/stardance-referrals";

declare global {
  var __stardanceRsvpSyncSchedulerStarted: boolean | undefined;
}

function isEnabled(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;

  const normalized = value.trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;

  return fallback;
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim() ?? "";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function runSync() {
  const startedAt = Date.now();

  try {
    await ensureSchema();
    const result = await syncAllStardanceRsvpReferrals();
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[stardance-rsvp-sync] ok (${elapsedMs}ms) processed=${result.processed} insertedOrUpdated=${result.insertedOrUpdated}`,
    );
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    console.error(
      `[stardance-rsvp-sync] failed (${elapsedMs}ms) ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function startStardanceRsvpSyncScheduler() {
  if (globalThis.__stardanceRsvpSyncSchedulerStarted === true) {
    return;
  }

  globalThis.__stardanceRsvpSyncSchedulerStarted = true;

  if (!isEnabled(process.env.STARDANCE_RSVP_SYNC_AUTOSTART, true)) {
    console.log("[stardance-rsvp-sync] autostart disabled");
    return;
  }

  const apiKey = process.env.STARDANCE_API_KEY?.trim();
  if (apiKey === undefined || apiKey === "") {
    console.log("[stardance-rsvp-sync] disabled because STARDANCE_API_KEY is not set");
    return;
  }

  const intervalMs = readPositiveIntegerEnv("STARDANCE_RSVP_SYNC_INTERVAL_MS", 60_000);
  let inFlight = false;

  const tick = async () => {
    if (inFlight) return;

    inFlight = true;

    try {
      await runSync();
    } finally {
      inFlight = false;
    }
  };

  console.log(`[stardance-rsvp-sync] running every ${Math.round(intervalMs / 1000)}s`);
  void tick();

  const intervalId = setInterval(() => {
    void tick();
  }, intervalMs);

  const shutdown = (signal: string) => {
    clearInterval(intervalId);
    console.log(`[stardance-rsvp-sync] stopping (${signal})`);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}
