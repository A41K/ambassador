export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { ensureSchema } = await import("@/lib/database/ensure-schema");
  await ensureSchema();

  const { startAirtableSyncScheduler } = await import(
    "@/lib/applications/airtable-sync-scheduler"
  );
  const { startHcbGrantScheduler } = await import(
    "@/lib/hcb/grant-scheduler"
  );
  const { startStardanceRsvpSyncScheduler } = await import(
    "@/lib/stardance-rsvp-sync-scheduler"
  );

  startAirtableSyncScheduler();
  startHcbGrantScheduler();
  startStardanceRsvpSyncScheduler();
}
