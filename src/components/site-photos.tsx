"use client";

import { Camera, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import { MAX, shrinkImage } from "./uploader";

export type SiteUpdateItem = {
  id: string;
  date: string;
  step: string;
  note: string | null;
  by: string;
  mine: boolean;
  createdAt: string;
  photos: { id: string; fileName: string }[];
};

/** Store page → Site photos tab: today's photos from Manju and the departments on site, by day. */
export function SitePhotos({
  storeId,
  updates,
  steps,
  today,
  status,
}: {
  storeId: string;
  updates: SiteUpdateItem[];
  steps: { moduleType: string; displayName: string }[];
  today: string;
  /** Why posting is not possible (before keys / launched), or null. */
  status: string | null;
}) {
  const router = useRouter();
  const cam = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(steps.length === 1 ? steps[0].moduleType : "");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = [...new Set(updates.map((u) => u.date))];
  const postedToday = updates.some((u) => u.date === today && u.photos.length > 0);

  function add(list: FileList | null) {
    if (list?.length) setPhotos((p) => [...p, ...Array.from(list)]);
    if (cam.current) cam.current.value = "";
    if (pick.current) pick.current.value = "";
  }

  async function post() {
    if (!step) return setError("Choose the work these photos show");
    if (!photos.length) return setError("Add at least one photo");
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>(`/api/stores/${storeId}/site-updates`, { body: { moduleType: step, note: note || null } });
      let ok = 0;
      for (const original of photos) {
        const file = await shrinkImage(original);
        if (file.size > MAX) {
          toast.error(`${original.name} is too large`);
          continue;
        }
        const form = new FormData();
        form.set("file", file);
        try {
          await api(`/api/site-updates/${id}/files`, { form });
          ok++;
        } catch (e) {
          toast.error(e instanceof ApiError ? `${original.name}: ${e.message}` : `${original.name}: upload failed`);
        }
      }
      toast.success(`Posted ${ok} photo${ok === 1 ? "" : "s"}`);
      setPhotos([]);
      setNote("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not post the update");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this update and its photos?")) return;
    try {
      await api(`/api/site-updates/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not remove it");
    }
  }

  return (
    <div className="space-y-4">
      {steps.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Post today&apos;s site photos</CardTitle>
            <p className="text-sm text-muted-foreground">{postedToday ? "Photos are in for today. Add more if the work moved on." : "No photos posted today yet."}</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Work shown *</Label>
              <Select value={step} onValueChange={setStep}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose the work" />
                </SelectTrigger>
                <SelectContent>
                  {steps.map((s) => (
                    <SelectItem key={s.moduleType} value={s.moduleType}>
                      {s.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Photos *</Label>
              <div className="flex flex-wrap gap-2">
                <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => add(e.target.files)} />
                <input ref={pick} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => add(e.target.files)} />
                <Button type="button" size="sm" variant="outline" onClick={() => cam.current?.click()} disabled={busy}>
                  <Camera className="size-4" /> Camera
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => pick.current?.click()} disabled={busy}>
                  <Upload className="size-4" /> Photos
                </Button>
              </div>
              {photos.length > 0 && <p className="text-xs text-muted-foreground">{photos.length} photo{photos.length === 1 ? "" : "s"} ready</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="site-note">Note</Label>
              <Textarea id="site-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Work done today, people on site, problems, tomorrow's plan" />
            </div>
            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <div className="sm:col-span-2">
              <Button onClick={post} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Post photos
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        status && <p className="text-sm text-muted-foreground">{status}</p>
      )}

      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground">No site photos yet.</p>
      ) : (
        days.map((d) => (
          <section key={d} className="space-y-2">
            <h3 className="text-sm font-medium">{d === today ? "Today" : formatDate(d)}</h3>
            <ul className="space-y-3">
              {updates
                .filter((u) => u.date === d)
                .map((u) => (
                  <li key={u.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        <span className="font-medium">{u.step}</span> <span className="text-muted-foreground">· {u.by}</span>
                      </span>
                      {u.mine && (
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => remove(u.id)}>
                          <Trash2 className="size-4" /> Remove
                        </Button>
                      )}
                    </div>
                    {u.note && <p className="text-sm whitespace-pre-line">{u.note}</p>}
                    {u.photos.length > 0 ? (
                      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                        {u.photos.map((p) => (
                          <li key={p.id}>
                            <a href={`/api/files/${p.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border bg-muted">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`/api/files/${p.id}`} alt={`${u.step} — ${p.fileName}`} className="aspect-square w-full object-cover" loading="lazy" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-destructive">No photos uploaded.</p>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
