import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import { getActorSession } from "@/lib/session";
import { isSuperuserConfigured, verifySuperuserPassword } from "@/lib/superuser";

function redirectWithSuperuserStatus(
  request: Request,
  formData: FormData,
  id: string,
  status: string,
) {
  const url = getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/users/${id}`);
  url.searchParams.set("superuser", status);
  return Response.redirect(url, 303);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getActorSession();
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  if (!(await isUserAdmin(session.sub))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const formData = await request.formData();

  if (!isSuperuserConfigured()) {
    return redirectWithSuperuserStatus(request, formData, id, "missing");
  }

  const existingUser = (await sql<{ id: string; is_admin: boolean | null }[]>`
    SELECT id, is_admin
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `).at(0) ?? null;

  if (existingUser === null) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (!verifySuperuserPassword(formData.get("superuserPassword"))) {
    await logAdminActionEvent({
      actorUserId: session.sub,
      targetUserId: id,
      action: "user_admin_password_rejected",
      metadata: {
        attemptedAction: "demote_admin",
      },
    });
    revalidatePath("/admin/audit-log");

    return redirectWithSuperuserStatus(request, formData, id, "invalid");
  }

  await sql`
    UPDATE users
    SET is_admin = FALSE,
        updated_at = NOW()
    WHERE id = ${id}
  `;

  if (existingUser.is_admin === true) {
    await logAdminActionEvent({
      actorUserId: session.sub,
      targetUserId: id,
      action: "user_demoted_from_admin",
      metadata: {
        previousIsAdmin: true,
        nextIsAdmin: false,
      },
    });
  }

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit-log");

  return Response.redirect(getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/users/${id}`), 303);
}
