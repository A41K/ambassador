import { fetchHackClubAddresses } from "@/lib/auth";
import sql from "@/lib/database/client";
import {
  isCompleteHackClubAddress,
  normalizeHackClubAddresses,
  type HackClubAddress,
} from "@/lib/settings";

type LoadUserHackClubAddressesInput = {
  userId: string;
  storedAddresses: unknown;
  accessToken: string | null;
};

export function getStoredHackClubAddresses(value: unknown) {
  return normalizeHackClubAddresses(value).filter(isCompleteHackClubAddress);
}

export async function cacheHackClubAddresses(userId: string, addresses: HackClubAddress[]) {
  const normalizedAddresses = normalizeHackClubAddresses(addresses);
  const primaryAddress = normalizedAddresses[0] ?? null;

  await sql`
    UPDATE users
    SET
      hca_street_address = ${primaryAddress?.line_1 ?? null},
      hca_locality = ${primaryAddress?.city ?? null},
      hca_region = ${primaryAddress?.state ?? null},
      hca_postal_code = ${primaryAddress?.postal_code ?? null},
      hca_country = ${primaryAddress?.country ?? null},
      hca_addresses = CAST(${JSON.stringify(normalizedAddresses)} AS JSONB),
      updated_at = NOW()
    WHERE id = ${userId}
  `;

  return normalizedAddresses;
}

export async function refreshHackClubAddresses(userId: string, accessToken: string) {
  const addresses = normalizeHackClubAddresses(await fetchHackClubAddresses(accessToken));
  return cacheHackClubAddresses(userId, addresses);
}

export async function loadUserHackClubAddresses({
  userId,
  storedAddresses,
  accessToken,
}: LoadUserHackClubAddressesInput) {
  const cachedAddresses = getStoredHackClubAddresses(storedAddresses);

  if (cachedAddresses.length > 0) {
    return {
      addresses: cachedAddresses,
      needsAddressRefresh: false,
    };
  }

  if (!accessToken) {
    return {
      addresses: [],
      needsAddressRefresh: true,
    };
  }

  try {
    const addresses = await refreshHackClubAddresses(userId, accessToken);

    return {
      addresses: addresses.filter(isCompleteHackClubAddress),
      needsAddressRefresh: false,
    };
  } catch (error) {
    console.error("Failed to hydrate cached Hack Club Auth addresses", {
      userId,
      error,
    });

    return {
      addresses: [],
      needsAddressRefresh: false,
    };
  }
}
