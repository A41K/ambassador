"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pillVariants } from "@/components/ui/pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PosterCampaignSummary } from "@/lib/posters/config";
import type { PosterStyle, PosterVerificationStatus } from "@/lib/posters/types";
import { cn } from "@/lib/utils";

type ClientPoster = {
  id: string;
  referral_code: string;
  poster_type: PosterStyle;
  verification_status: PosterVerificationStatus;
  campaign_slug: string;
  poster_group_id: string | null;
  location_description: string | null;
};

type ClientPosterGroup = {
  id: string;
  name: string | null;
  campaign_slug: string;
  poster_count: number;
  posters: ClientPoster[];
};

type ClientPosterData = {
  groups: ClientPosterGroup[];
  standalonePosters: ClientPoster[];
};

type ScanResult = {
  status:
    | "success"
    | "auto_matched"
    | "already_verified"
    | "in_review"
    | "no_qr"
    | "no_match"
    | "wrong_group";
  detectedQrCodes: string[];
  message: string;
};

type GeoState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; latitude: number; longitude: number; accuracy: number }
  | { kind: "error"; message: string };

type VerifyTarget =
  | { kind: "poster"; poster: ClientPoster }
  | { kind: "group"; group: ClientPosterGroup };

const POSTER_STYLES: PosterStyle[] = ["color", "bw", "printer_efficient"];
const SUPPORTED_PROOF_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".heic", ".heif", ".webp"];
const SUPPORTED_PROOF_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const SUPPORTED_PROOF_IMAGE_FORMATS = "PNG, JPG, HEIC, WebP";
const PROOF_IMAGE_ACCEPT = [
  ...SUPPORTED_PROOF_IMAGE_MIME_TYPES,
  ...SUPPORTED_PROOF_IMAGE_EXTENSIONS,
].join(",");

function isSafePreviewUrl(value: string) {
  try {
    return new URL(value).protocol === "blob:";
  } catch {
    return false;
  }
}

function isSupportedProofImage(file: File) {
  const type = file.type.trim().toLowerCase();
  if (type && SUPPORTED_PROOF_IMAGE_MIME_TYPES.has(type)) {
    return true;
  }

  const name = file.name.trim().toLowerCase();
  return SUPPORTED_PROOF_IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function PostersClient({
  campaigns,
  initialCampaignSlug,
  initialData,
}: {
  campaigns: PosterCampaignSummary[];
  initialCampaignSlug: string | null;
  initialData: ClientPosterData;
}) {
  const t = useTranslations("posters");
  const data = initialData;
  const [campaignSlug, setCampaignSlug] = useState<string | null>(initialCampaignSlug);
  const [posterType, setPosterType] = useState<PosterStyle>("color");
  const [groupName, setGroupName] = useState("");
  const [groupSize, setGroupSize] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<VerifyTarget | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const campaign = useMemo(
    () => campaigns.find((c) => c.slug === campaignSlug) ?? null,
    [campaigns, campaignSlug],
  );
  const availableStyles = campaign?.styles ?? POSTER_STYLES;

  useEffect(() => {
    if (!availableStyles.includes(posterType)) {
      setPosterType(availableStyles[0] ?? "color");
    }
  }, [availableStyles, posterType]);

  const refresh = useCallback(async () => {
    window.location.reload();
  }, []);

  const createPoster = useCallback(async () => {
    if (campaignSlug === null) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/posters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignSlug, posterType }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      await refresh();
    } catch {
      setError(t("errors.create-failed"));
    } finally {
      setBusy(false);
    }
  }, [campaignSlug, posterType, refresh, t]);

  const createGroup = useCallback(async () => {
    if (campaignSlug === null) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/poster-groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaignSlug,
          posterType,
          count: groupSize,
          name: groupName.trim() || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setGroupName("");
      setGroupSize(3);
      await refresh();
    } catch {
      setError(t("errors.create-failed"));
    } finally {
      setBusy(false);
    }
  }, [campaignSlug, posterType, groupSize, groupName, refresh, t]);

  const handleVerified = useCallback(async () => {
    setVerifyTarget(null);
    await refresh();
  }, [refresh]);

  const allPosters = [
    ...data.standalonePosters,
    ...data.groups.flatMap((g) => g.posters),
  ];
  const pendingPosters = allPosters.filter((p) => p.verification_status === "pending");
  const verifiedCount = allPosters.filter((p) => p.verification_status === "success").length;
  const totalPosters = allPosters.length;

  return (
    <div className="space-y-10">
      {error !== null ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {/* Scan action */}
      {pendingPosters.length > 0 ? (
        <section>
          <p className="text-base leading-relaxed text-muted-foreground">
            You have {pendingPosters.length} poster{pendingPosters.length !== 1 ? "s" : ""} waiting to be verified.
            Put them up somewhere, then scan.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {data.groups.some((g) => g.posters.some((p) => p.verification_status === "pending")) && (
              <Button
                size="app"
                onClick={() => {
                  const group = data.groups.find((g) => g.posters.some((p) => p.verification_status === "pending"));
                  if (group) setVerifyTarget({ kind: "group", group });
                }}
              >
                Scan group →
              </Button>
            )}
            {data.standalonePosters.some((p) => p.verification_status === "pending") && (
              <Button
                size="app"
                onClick={() => {
                  const poster = data.standalonePosters.find((p) => p.verification_status === "pending");
                  if (poster) setVerifyTarget({ kind: "poster", poster });
                }}
              >
                Scan poster →
              </Button>
            )}
          </div>
        </section>
      ) : totalPosters > 0 ? (
        <section>
          <p className="text-base text-acceptance">All {totalPosters} poster{totalPosters !== 1 ? "s" : ""} verified ✓</p>
        </section>
      ) : null}

      {/* Stats */}
      {totalPosters > 0 && (
        <section className="flex flex-wrap items-center gap-6">
          <Stat value={totalPosters} label="total" />
          <Stat value={verifiedCount} label="verified" tone="acceptance" />
          <Stat value={pendingPosters.length} label="pending" tone="accent" />
        </section>
      )}

      {/* Groups */}
      {data.groups.length > 0 && (
        <section>
          <h2 className="font-sub text-2xl text-white">{t("groups.title")}</h2>
          <div className="mt-4 space-y-4">
            {data.groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onVerify={() => setVerifyTarget({ kind: "group", group })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Standalone */}
      {data.standalonePosters.length > 0 && (
        <section>
          <h2 className="font-sub text-2xl text-white">{t("singles.title")}</h2>
          <ul className="mt-4 space-y-2">
            {data.standalonePosters.map((poster) => (
              <PosterRow
                key={poster.id}
                poster={poster}
                onVerify={() => setVerifyTarget({ kind: "poster", poster })}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Create */}
      <section>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 text-left"
        >
          <span className="font-sub text-2xl text-white">+ New posters</span>
          <span className={cn("text-muted-foreground transition-transform", showCreate && "rotate-180")}>↓</span>
        </button>

        {showCreate && (
          <div className="mt-5">
            <CreateSection
              campaigns={campaigns}
              campaignSlug={campaignSlug}
              setCampaignSlug={setCampaignSlug}
              availableStyles={availableStyles}
              posterType={posterType}
              setPosterType={setPosterType}
              groupName={groupName}
              setGroupName={setGroupName}
              groupSize={groupSize}
              setGroupSize={setGroupSize}
              busy={busy}
              createPoster={createPoster}
              createGroup={createGroup}
            />
          </div>
        )}
      </section>

      {verifyTarget ? (
        <VerifyModal
          target={verifyTarget}
          onClose={() => setVerifyTarget(null)}
          onDone={handleVerified}
        />
      ) : null}
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "acceptance" | "accent" }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-2xl leading-none", tone ? `text-${tone}` : "text-white")}>{value}</span>
      <span className="font-body text-base leading-none text-muted-foreground">{label}</span>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between text-sm text-primary">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} className="ml-3 text-primary/80 hover:text-primary">
        ✕
      </button>
    </div>
  );
}

function GroupCard({
  group,
  onVerify,
}: {
  group: ClientPosterGroup;
  onVerify: () => void;
}) {
  const t = useTranslations("posters");
  const pendingCount = group.posters.filter((p) => p.verification_status === "pending").length;
  const verifiedCount = group.posters.filter((p) => p.verification_status === "success").length;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-body text-base text-white">
            {group.name !== null && group.name.trim() !== "" ? group.name : t("groups.unnamed")}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("groups.count", { count: group.poster_count })}
            {verifiedCount > 0 && <span className="text-acceptance"> · {verifiedCount} verified</span>}
            {pendingCount > 0 && <span className="text-accent"> · {pendingCount} pending</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="app-sm">
            <a href={`/api/poster-groups/${group.id}/pdf`}>
              {t("actions.download")} ↓
            </a>
          </Button>
          {pendingCount > 0 && (
            <Button size="app-sm" onClick={onVerify}>
              Scan →
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {group.posters.map((poster) => (
          <PosterChip key={poster.id} poster={poster} />
        ))}
      </div>
    </div>
  );
}

function PosterChip({ poster }: { poster: ClientPoster }) {
  const statusColor: Record<PosterVerificationStatus, string> = {
    pending: "text-accent",
    in_review: "text-accent",
    success: "text-acceptance",
    rejected: "text-primary",
    digital: "text-muted-foreground",
  };

  const prefix = poster.verification_status === "success" ? "✓ " : poster.verification_status === "rejected" ? "✕ " : "";

  return (
    <span className={cn("font-mono text-xs", statusColor[poster.verification_status])}>
      {prefix}{poster.referral_code}
    </span>
  );
}

function PosterRow({
  poster,
  onVerify,
}: {
  poster: ClientPoster;
  onVerify: () => void;
}) {
  const t = useTranslations("posters");
  const statusColor: Record<PosterVerificationStatus, string> = {
    pending: "text-accent",
    in_review: "text-accent",
    success: "text-acceptance",
    rejected: "text-primary",
    digital: "text-muted-foreground",
  };

  return (
    <li className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-white">{poster.referral_code}</span>
        <span className={cn("text-xs", statusColor[poster.verification_status])}>
          {t(`status.${poster.verification_status}`)}
        </span>
      </div>
      <div className="flex gap-2">
        <a
          href={`/api/posters/${poster.id}/pdf`}
          className="text-sm text-muted-foreground hover:text-white"
        >
          ↓
        </a>
        {poster.verification_status === "pending" && (
          <button
            type="button"
            onClick={onVerify}
            className="text-sm text-primary hover:opacity-80"
          >
            Scan →
          </button>
        )}
      </div>
    </li>
  );
}

function CreateSection({
  campaigns,
  campaignSlug,
  setCampaignSlug,
  availableStyles,
  posterType,
  setPosterType,
  groupName,
  setGroupName,
  groupSize,
  setGroupSize,
  busy,
  createPoster,
  createGroup,
}: {
  campaigns: PosterCampaignSummary[];
  campaignSlug: string | null;
  setCampaignSlug: (value: string) => void;
  availableStyles: PosterStyle[];
  posterType: PosterStyle;
  setPosterType: (value: PosterStyle) => void;
  groupName: string;
  setGroupName: (value: string) => void;
  groupSize: number;
  setGroupSize: (value: number) => void;
  busy: boolean;
  createPoster: () => void;
  createGroup: () => void;
}) {
  const t = useTranslations("posters");

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs tracking-wide text-muted-foreground">
            {t("campaign.label")}
          </label>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("campaign.empty")}</p>
          ) : (
            <Select value={campaignSlug ?? undefined} onValueChange={setCampaignSlug}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("campaign.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs tracking-wide text-muted-foreground">
            Style
          </label>
          <div className="flex flex-wrap gap-2">
            {availableStyles.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setPosterType(style)}
                className={cn(
                  "font-body transition-opacity hover:opacity-80",
                  posterType === style
                    ? pillVariants({ tone: "red" })
                    : pillVariants({ tone: "black" }),
                )}
              >
                {t(`styles.${style}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t("singles.title")}</p>
          <Button size="app" onClick={createPoster} disabled={busy || campaignSlug === null}>
            {t("actions.create-poster")} +
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t("groups.title")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder={t("groups.name-placeholder")}
              className="flex-1"
            />
            <Input
              type="number"
              min={1}
              max={10}
              value={groupSize}
              onChange={(event) => setGroupSize(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
              aria-label={t("groups.size-label")}
              className="w-24"
            />
          </div>
          <Button size="app" onClick={createGroup} disabled={busy || campaignSlug === null}>
            {t("actions.create-group")} +
          </Button>
        </div>
      </div>
    </div>
  );
}

function useGeolocation(enabled: boolean) {
  const t = useTranslations("posters");
  const [state, setState] = useState<GeoState>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const geolocation = typeof navigator === "undefined" ? null : navigator.geolocation;
  const unavailableState: GeoState = { kind: "error", message: t("errors.geolocation-unavailable") };

  const retry = useCallback(() => {
    setState({ kind: "pending" });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (geolocation === null) return;

    let cancelled = false;

    const watchId = geolocation.watchPosition(
      (position) => {
        if (cancelled) return;
        setState({
          kind: "ok",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (err) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            err.code === err.PERMISSION_DENIED ? t("errors.geolocation-denied") : err.message,
        });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );

    return () => {
      cancelled = true;
      geolocation.clearWatch(watchId);
    };
  }, [enabled, attempt, geolocation, t]);

  const resolvedState: GeoState = !enabled
    ? { kind: "idle" }
    : geolocation === null
      ? unavailableState
      : state.kind === "idle"
        ? { kind: "pending" }
        : state;

  return { state: resolvedState, start: retry };
}

function VerifyModal({
  target,
  onClose,
  onDone,
}: {
  target: VerifyTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("posters");
  const { state: geoState, start: retryGeo } = useGeolocation(true);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [locationDescription, setLocationDescription] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file === null) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canSubmit =
    !submitting &&
    file !== null &&
    locationDescription.trim().length > 0 &&
    geoState.kind === "ok";

  const targetLabel =
    target.kind === "group"
      ? target.group.name !== null && target.group.name.trim() !== ""
        ? target.group.name
        : t("groups.unnamed")
      : t("poster-card.referral", { code: target.poster.referral_code });
  const safePreviewUrl = previewUrl !== null && isSafePreviewUrl(previewUrl) ? previewUrl : null;
  const handleSelectedFile = useCallback(
    (nextFile: File | null) => {
      if (!nextFile) {
        setFile(null);
        return;
      }

      if (!isSupportedProofImage(nextFile)) {
        setFile(null);
        setError(t("errors.invalid-image-format", { formats: SUPPORTED_PROOF_IMAGE_FORMATS }));
        return;
      }

      setError(null);
      setFile(nextFile);
    },
    [t],
  );

  const handleSubmit = useCallback(async () => {
    if (geoState.kind !== "ok" || !file) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("proof", file);
      formData.append("locationDescription", locationDescription);
      formData.append("latitude", String(geoState.latitude));
      formData.append("longitude", String(geoState.longitude));
      formData.append("locationAccuracy", String(geoState.accuracy));

      const url =
        target.kind === "group"
          ? `/api/poster-groups/${target.group.id}/scan`
          : `/api/posters/${target.poster.id}/proof`;

      const response = await fetch(url, { method: "POST", body: formData });
      const data = await response.json().catch(() => null);
      const payload: Record<string, unknown> | null =
        typeof data === "object" && data !== null && !Array.isArray(data)
          ? Object.fromEntries(Object.entries(data))
          : null;
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : t("errors.upload-failed"));
      }
      const status = payload?.status;
      const detectedQrCodes = Array.isArray(payload?.detectedQrCodes)
        ? payload.detectedQrCodes.filter((code): code is string => typeof code === "string")
        : null;
      const message = payload?.message;
      if (
        status !== "success" &&
        status !== "auto_matched" &&
        status !== "already_verified" &&
        status !== "in_review" &&
        status !== "no_qr" &&
        status !== "no_match" &&
        status !== "wrong_group"
      ) {
        throw new Error(t("errors.upload-failed"));
      }
      if (detectedQrCodes === null || typeof message !== "string") {
        throw new Error(t("errors.upload-failed"));
      }
      setResult({ status, detectedQrCodes, message });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.upload-failed"));
    } finally {
      setSubmitting(false);
    }
  }, [file, geoState, locationDescription, target, t]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-6">
      <div className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[var(--topbar)] sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs text-muted-foreground">{targetLabel}</p>
            <h3 className="font-sub text-xl text-white">{t("verify-modal.title")}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-white"
            aria-label={t("actions.cancel")}
          >
            ✕
          </button>
        </div>

        {/* Progress */}
        {!result && (
          <div className="flex gap-1 px-5">
            <div className={cn("h-0.5 flex-1 rounded-full", file ? "bg-acceptance" : "bg-primary")} />
            <div className={cn("h-0.5 flex-1 rounded-full", geoState.kind === "ok" ? "bg-acceptance" : file ? "bg-primary" : "bg-white/10")} />
            <div className={cn("h-0.5 flex-1 rounded-full", canSubmit ? "bg-primary" : "bg-white/10")} />
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {result ? (
            <ResultView result={result} />
          ) : (
            <div className="space-y-5">
              {/* Photo */}
              {safePreviewUrl !== null ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg">
                  <Image
                    src={safePreviewUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 100vw, 32rem"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-1 text-xs text-white backdrop-blur-sm"
                  >
                    retake
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t("verify-modal.description")}
                  </p>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept={PROOF_IMAGE_ACCEPT}
                    capture="environment"
                    className="hidden"
                    onChange={(event) => handleSelectedFile(event.target.files?.[0] ?? null)}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={PROOF_IMAGE_ACCEPT}
                    className="hidden"
                    onChange={(event) => handleSelectedFile(event.target.files?.[0] ?? null)}
                  />
                  <div className="flex gap-2">
                    <Button size="app" onClick={() => cameraInputRef.current?.click()}>
                      {t("actions.use-camera")} →
                    </Button>
                    <Button variant="secondary" size="app" onClick={() => fileInputRef.current?.click()}>
                      {t("actions.choose-file")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Location */}
              {file !== null && <GeolocationStatus state={geoState} onRetry={retryGeo} />}

              {/* Description */}
              {file !== null && geoState.kind === "ok" && (
                <div className="space-y-2">
                  <label className="text-xs tracking-wide text-muted-foreground">
                    Where is this poster?
                  </label>
                  <Textarea
                    value={locationDescription}
                    onChange={(event) => setLocationDescription(event.target.value)}
                    placeholder={t("verify-modal.location-description-placeholder")}
                    rows={2}
                    required
                    autoFocus
                  />
                  {target.kind === "group" && (
                    <p className="text-xs text-muted-foreground">{t("verify-modal.auto-detect")}</p>
                  )}
                </div>
              )}

              {error !== null && <p className="text-sm text-primary">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2">
          {result ? (
            <Button
              size="app"
              className="w-full"
              onClick={() => {
                setResult(null);
                onDone();
              }}
            >
              Done
            </Button>
          ) : (
            <Button
              size="app"
              className="w-full"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? t("actions.submitting") : `${t("actions.submit")} →`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function GeolocationStatus({ state, onRetry }: { state: GeoState; onRetry: () => void }) {
  const t = useTranslations("posters");

  if (state.kind === "ok") {
    return (
      <p className="text-sm text-acceptance">
        ✓ Location locked · ±{Math.round(state.accuracy)}m
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-primary">{state.message}</p>
        <button type="button" onClick={onRetry} className="text-sm text-muted-foreground hover:text-white">
          {t("verify-modal.location-retry")} →
        </button>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Acquiring location...
    </p>
  );
}

function ResultView({ result }: { result: ScanResult }) {
  const t = useTranslations("posters");
  const isSuccess = result.status === "success" || result.status === "auto_matched" || result.status === "already_verified";
  const isReview = result.status === "in_review";

  return (
    <div className="space-y-3 py-4">
      <p className={cn("font-sub text-2xl", isSuccess ? "text-acceptance" : isReview ? "text-accent" : "text-primary")}>
        {isSuccess ? "✓" : isReview ? "◷" : "✕"} {t(`results.${result.status}`)}
      </p>
      <p className="text-base text-muted-foreground">{result.message}</p>
      {result.detectedQrCodes.length > 0 && (
        <p className="font-mono text-xs text-muted-foreground">
          {result.detectedQrCodes.join(" · ")}
        </p>
      )}
    </div>
  );
}
