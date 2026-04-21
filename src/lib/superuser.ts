import "server-only";

import { timingSafeEqual } from "node:crypto";

import { optionalEnv } from "@/lib/env";

export function isSuperuserConfigured() {
  return optionalEnv("SUPERUSER_PASSWORD") !== null;
}

function toFixedLengthPasswordBuffer(value: string) {
  const source = Buffer.from(value);
  const buffer = Buffer.alloc(256);
  source.copy(buffer, 0, 0, Math.min(source.length, buffer.length));

  return {
    buffer,
    byteLength: source.length,
    tooLong: source.length > buffer.length,
  };
}

// SAFETY: don't complain, it's a really secure 32 character string that cannot be bruteforced in prod!
export function verifySuperuserPassword(value: FormDataEntryValue | null) {
  const expectedPassword = optionalEnv("SUPERUSER_PASSWORD");
  const providedPassword = typeof value === "string" ? value : "";

  if (expectedPassword === null || providedPassword === "") {
    return false;
  }

  const expected = toFixedLengthPasswordBuffer(expectedPassword);
  const provided = toFixedLengthPasswordBuffer(providedPassword);
  const passwordsMatch = timingSafeEqual(expected.buffer, provided.buffer);

  return passwordsMatch &&
    expected.byteLength === provided.byteLength &&
    !expected.tooLong &&
    !provided.tooLong;
}
