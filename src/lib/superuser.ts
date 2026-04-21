import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { optionalEnv } from "@/lib/env";

export function isSuperuserConfigured() {
  return optionalEnv("SUPERUSER_PASSWORD") !== null;
}

export function verifySuperuserPassword(value: FormDataEntryValue | null) {
  const expectedPassword = optionalEnv("SUPERUSER_PASSWORD");
  const providedPassword = typeof value === "string" ? value : "";

  if (expectedPassword === null || providedPassword === "") {
    return false;
  }

  const expectedHash = createHash("sha256").update(expectedPassword).digest();
  const providedHash = createHash("sha256").update(providedPassword).digest();

  return timingSafeEqual(expectedHash, providedHash);
}
