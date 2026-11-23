"use client";

import { Camera, CheckCircle2, Loader2, Plus, RotateCcw, Trash2, Upload, Video, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client-api";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MAX, shrinkImage } from "./uploader";

export type SnagItem = {
  id: string;
  stage: "KEY_HANDOVER" | "PRE_LAUNCH";
  title: string;
  details: string | null;
  team: string;
  teamLabel: string;
  dueDate: string | null;
  overdue: boolean;
  status: "OPEN" | "FIXED" | "CLOSED";
  raisedBy: string;
  raisedAt: string;
  fixedBy: string | null;
  fixedAt: string | null;
  fixNote: string | null;
  closedBy: string | null;
  closedAt: string | null;
  returnNote: string | null;
  before: Media[];
  after: Media[];
  canFix: boolean;
  canClose: boolean;
  canDelete: boolean;
  canAddBefore: boolean;
};
type Media = { id: string; fileType: string; fileName: string };

const STAGES = { KEY_HANDOVER: "At key handover", PRE_LAUNCH: "Before soft launch" } as const;
const STATUS = {
  OPEN: { label: "Open", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  FIXED: { label: "Fixed · to check", className: "bg-amber-100 text-amber-900 hover:bg-amber-100" },
  CLOSED: { label: "Closed", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
} as const;

/** Uploads files one by one (photos shrunk first); returns how many went up. */
async function uploadAll(endpoint: string, tag: string, list: FileList | File[]) {
  let ok = 0;
  for (const original of Array.from(list)) {
    const file = await shrinkImage(original);
    if (file.size > MAX) {
      toast.error(`${original.name} is too large (max 4 MB per file). Record a shorter video.`);
      continue;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("tag", tag);
    try {
      await api(endpoint, { form });
      ok++;
    } catch (e) {
      toast.error(e instanceof ApiError ? `${original.name}: ${e.message}` : `${original.name}: upload failed`);
    }
  }
  return ok;
}

function MediaGrid({ items }: { items: Media[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((m) => (
        <li key={m.id}>
          {m.fileType.startsWith("video/") ? (
            <video src={`/api/files/${m.id}`} controls preload="metadata" playsInline className="h-28 w-40 rounded-md border bg-black object-cover" />
          ) : m.fileType.startsWith("image/") ? (
            <a href={`/api/files/${m.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${m.id}`} alt={m.fileName} className="size-28 object-cover" loading="lazy" />
            </a>
          ) : (
            <a href={`/api/files/${m.id}`} target="_blank" rel="noreferrer" className="text-sm underline">
              {m.fileName}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Hidden inputs + buttons: camera photo, camera video, or pick files. */
function MediaButtons({ onFiles, busy, video, label = "Photos" }: { onFiles: (f: FileList) => void; busy: boolean; video?: boolean; label?: string }) {
  const cam = useRef<HTMLInputElement>(null);
  const vid = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) onFiles(e.target.files);
    e.target.value = "";
  };
  return (
    <div className="flex flex-wrap gap-2">
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={take} />
      {video && <input ref={vid} type="file" accept="video/*" capture="environment" className="hidden" onChange={take} />}
      <input ref={pick} type="file" accept={video ? "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" : "image/jpeg,image/png,image/webp"} multiple className="hidden" onChange={take} />
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => cam.current?.click()}>
        <Camera className="size-4" /> Camera
      </Button>
      {video && (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => vid.current?.click()}>
          <Video className="size-4" /> Video
        </Button>
      )}
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => pick.current?.click()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {label}
      </Button>
    </div>
  );
}

function NewSnagForm({ storeId, teams, defaultStage, defaultDue, onDone }: { storeId: string; teams: { key: string; label: string }[]; defaultStage: SnagItem["stage"]; defaultDue: string; onDone: () => void }) {
  const router = useRouter();
  const [stage, setStage] = useState<SnagItem["stage"]>(defaultStage);
  const [team, setTeam] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!photos.length) return setErrors({ photos: "Add at least one photo of the snag" });
    setBusy(true);
    setErrors({});
    try {
      const { id } = await api<{ id: string }>(`/api/stores/${storeId}/snags`, {
        body: { stage, team, title: String(f.get("title") ?? ""), details: String(f.get("details") ?? "") || null, dueDate: String(f.get("dueDate") ?? "") },
      });
      const ok = await uploadAll(`/api/snags/${id}/files`, "snag_before", photos);
      toast.success(`Snag logged${ok < photos.length ? " — some photos failed, add them again" : ""}`);
      onDone();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors ?? {});
        toast.error(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2" noValidate>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="snag-title">What is wrong? *</Label>
        <Input id="snag-title" name="title" required placeholder="e.g. Shutter lock jammed, wall crack near entrance" />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>When found *</Label>
        <Select value={stage} onValueChange={(v) => setStage(v as SnagItem["stage"])}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STAGES).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Who fixes it *</Label>
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose department" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.team && <p className="text-xs text-destructive">{errors.team}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="snag-due">Fix by *</Label>
        <Input id="snag-due" name="dueDate" type="date" defaultValue={defaultDue} required />
        {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate}</p>}
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="snag-details">Details</Label>
        <Textarea id="snag-details" name="details" rows={2} placeholder="Where exactly, what needs to be done" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Photo of the snag *</Label>
        <MediaButtons busy={busy} onFiles={(l) => setPhotos((p) => [...p, ...Array.from(l)])} />
        {photos.length > 0 && <p className="text-xs text-muted-foreground">{photos.map((p) => p.name).join(", ")}</p>}
        {errors.photos && <p className="text-xs text-destructive">{errors.photos}</p>}
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} Log snag
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SnagCard({ s }: { s: SnagItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sendingBack, setSendingBack] = useState(false);

  async function run(kind: string, fn: () => Promise<unknown>, success: string) {
    setBusy(kind);
    try {
      await fn();
      toast.success(success);
      setNote("");
      setSendingBack(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }
  async function upload(tag: string, list: FileList) {
    setBusy(tag);
    const ok = await uploadAll(`/api/snags/${s.id}/files`, tag, list);
    setBusy(null);
    if (ok) {
      toast.success(`${ok} file${ok > 1 ? "s" : ""} uploaded`);
      router.refresh();
    }
  }

  return (
    <li className={cn("space-y-3 rounded-lg border p-3", s.overdue && "border-red-300")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{s.title}</p>
          <p className="text-xs text-muted-foreground">
            {STAGES[s.stage]} · {s.teamLabel} fixes it · by {s.dueDate ? formatDate(s.dueDate) : "—"}
            {s.overdue && <span className="font-medium text-red-600"> · late</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            Logged by {s.raisedBy}, {formatDateTime(s.raisedAt)}
          </p>
        </div>
        <Badge className={STATUS[s.status].className}>{STATUS[s.status].label}</Badge>
      </div>
      {s.details && <p className="text-sm">{s.details}</p>}
      {s.returnNote && s.status === "OPEN" && (
        <p className="rounded-md bg-red-50 px-2 py-1.5 text-sm text-red-800">
          <RotateCcw className="mr-1 inline size-3.5" aria-hidden />
          Sent back: {s.returnNote}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Snag</p>
          <MediaGrid items={s.before} />
          {!s.before.length && <p className="text-xs text-destructive">No photo yet.</p>}
          {s.canAddBefore && <MediaButtons busy={!!busy} onFiles={(l) => upload("snag_before", l)} label="Add photo" />}
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Fix (photo or video)</p>
          <MediaGrid items={s.after} />
          {!s.after.length && <p className="text-xs text-muted-foreground">Not fixed yet.</p>}
          {s.fixedBy && s.fixedAt && (
            <p className="text-xs text-muted-foreground">
              Marked fixed by {s.fixedBy}, {formatDateTime(s.fixedAt)}
              {s.fixNote ? ` — ${s.fixNote}` : ""}
            </p>
          )}
          {s.closedBy && s.closedAt && (
            <p className="text-xs text-emerald-700">
              <CheckCircle2 className="mr-1 inline size-3.5" aria-hidden />
              Closed by {s.closedBy}, {formatDateTime(s.closedAt)}
            </p>
          )}
          {s.canFix && s.status === "OPEN" && <MediaButtons busy={!!busy} video onFiles={(l) => upload("snag_after", l)} label="Files" />}
        </div>
      </div>
      {(s.canFix && s.status === "OPEN") || s.canClose || s.canDelete ? (
        <div className="space-y-2 border-t pt-3">
          {(s.canFix && s.status === "OPEN") || sendingBack ? (
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={sendingBack ? "What is still wrong? (required)" : "Note on the fix (optional)"} />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {s.canFix && s.status === "OPEN" && (
              <Button size="sm" disabled={!!busy || !s.after.length} onClick={() => run("fix", () => api(`/api/snags/${s.id}/fixed`, { body: { note: note || null } }), "Marked fixed — sent for checking")}>
                {busy === "fix" ? <Loader2 className="size-4 animate-spin" /> : <Wrench className="size-4" />} Mark fixed
              </Button>
            )}
            {s.canFix && s.status === "OPEN" && !s.after.length && <span className="self-center text-xs text-muted-foreground">Upload a photo or video of the fix first.</span>}
            {s.canClose && !sendingBack && (
              <>
                <Button size="sm" disabled={!!busy} onClick={() => run("close", () => api(`/api/snags/${s.id}/decision`, { body: { decision: "close" } }), "Snag closed")}>
                  {busy === "close" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Seen the fix · Close
                </Button>
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setSendingBack(true)}>
                  <RotateCcw className="size-4" /> Send back
                </Button>
              </>
            )}
            {sendingBack && (
              <>
                <Button size="sm" variant="destructive" disabled={!!busy || !note.trim()} onClick={() => run("back", () => api(`/api/snags/${s.id}/decision`, { body: { decision: "send_back", note } }), "Sent back to the team")}>
                  {busy === "back" && <Loader2 className="size-4 animate-spin" />} Send back
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSendingBack(false)}>
                  Cancel
                </Button>
              </>
            )}
            {s.canDelete && (
              <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" disabled={!!busy} onClick={() => confirm("Remove this snag?") && run("del", () => api(`/api/snags/${s.id}`, { method: "DELETE" }), "Snag removed")}>
                <Trash2 className="size-4" /> Remove
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Store page → Snags tab. */
export function SnagPanel({
  storeId,
  snags,
  canRaise,
  teams,
  defaultStage,
  defaultDue,
}: {
  storeId: string;
  snags: SnagItem[];
  canRaise: boolean;
  teams: { key: string; label: string }[];
  defaultStage: SnagItem["stage"];
  /** Fix-by date offered for a new snag (today + 3 days). */
  defaultDue: string;
}) {
  const [adding, setAdding] = useState(false);
  const open = snags.filter((s) => s.status === "OPEN").length;
  const fixed = snags.filter((s) => s.status === "FIXED").length;
  const closed = snags.filter((s) => s.status === "CLOSED").length;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">Snag list</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {open} open · {fixed} to check · {closed} closed. The soft launch waits until every snag is closed.
          </p>
        </div>
        {canRaise && !adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Log a snag
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && <NewSnagForm storeId={storeId} teams={teams} defaultStage={defaultStage} defaultDue={defaultDue} onDone={() => setAdding(false)} />}
        {snags.length ? (
          <ul className="space-y-3">
            {snags.map((s) => (
              <SnagCard key={s.id} s={s} />
            ))}
          </ul>
        ) : (
          !adding && <p className="text-sm text-muted-foreground">No snags logged. Log any defect found at the key handover or before the soft launch, with a photo.</p>
        )}
      </CardContent>
    </Card>
  );
}
