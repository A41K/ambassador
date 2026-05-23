import {
  deletePosterForUser,
  getPosterForUserOrThrow,
  movePosterForUser,
  renamePosterForUser,
} from "@/lib/posters/service";
import { isSameOriginRequest, posterErrorResponse, requirePosterSession } from "@/lib/posters/http";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/posters/[id]">) {
  try {
    const session = await requirePosterSession();
    const { id } = await context.params;
    const poster = await getPosterForUserOrThrow(session.sub, id);
    return Response.json({ poster });
  } catch (error) {
    return posterErrorResponse(error, "Failed to load poster.", 404);
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/posters/[id]">) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const session = await requirePosterSession();
    const rateLimit = await checkRateLimit({
      scope: "poster-write",
      key: getRateLimitKey(session.sub),
      limit: 1_000,
    });

    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      groupId?: unknown;
    } | null;

    if (body !== null && "groupId" in body) {
      const rawGroupId = body.groupId;
      if (rawGroupId !== null && typeof rawGroupId !== "string") {
        return Response.json({ error: "Invalid groupId." }, { status: 400 });
      }
      const result = await movePosterForUser({
        userId: session.sub,
        posterId: id,
        groupId: typeof rawGroupId === "string" && rawGroupId.trim() !== "" ? rawGroupId : null,
      });
      return Response.json(result);
    }

    const rawName = body?.name;
    if (rawName !== null && typeof rawName !== "string" && rawName !== undefined) {
      return Response.json({ error: "Invalid name." }, { status: 400 });
    }

    const result = await renamePosterForUser(
      session.sub,
      id,
      typeof rawName === "string" ? rawName : null,
    );
    return Response.json(result);
  } catch (error) {
    return posterErrorResponse(error, "Failed to rename poster.", 400);
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/posters/[id]">) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const session = await requirePosterSession();
    const rateLimit = await checkRateLimit({
      scope: "poster-write",
      key: getRateLimitKey(session.sub),
      limit: 1_000,
    });

    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const { id } = await context.params;
    const result = await deletePosterForUser(session.sub, id);
    return Response.json(result);
  } catch (error) {
    return posterErrorResponse(error, "Failed to delete poster.", 400);
  }
}
