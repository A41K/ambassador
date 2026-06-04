import "server-only";

import { listHcbOrganizationTransactions } from "@/lib/hcb/service";

// Share links like hcb.hackclub.com/hcb/<hashid> use HcbCode hashids the API
// can't resolve, so the closest verification for a pasted transfer link is
// matching the payout amount against the org's recent ledger via HCB's
// authenticated v4 API. Needs HCB authorized and access to the payout org.
export type HcbAmountMatch = {
  date: string;
  memo: string | null;
  type: string;
  pending: boolean;
};

/**
 * Best-effort: recent org transactions whose absolute amount equals
 * `amountCents`. Returns `null` when the lookup isn't possible (no
 * `HCB_PAYOUT_ORG_SLUG` configured, HCB not authorized, network failure) so
 * callers can tell "couldn't check" apart from "checked, found nothing".
 */
export async function findHcbTransactionsByAmount(
  amountCents: number,
): Promise<HcbAmountMatch[] | null> {
  const orgSlug = process.env.HCB_PAYOUT_ORG_SLUG?.trim();
  if (!orgSlug || amountCents <= 0) {
    return null;
  }

  try {
    const transactions = await listHcbOrganizationTransactions(orgSlug, { maxPages: 4 });

    return transactions
      .filter((txn) => Math.abs(txn.amountCents) === amountCents)
      .slice(0, 5)
      .map((txn) => ({
        date: txn.date ?? "",
        memo: txn.memo,
        type: txn.expensePayoutReportId !== null ? "reimbursed_expense" : "transaction",
        pending: txn.pending,
      }));
  } catch {
    return null;
  }
}
