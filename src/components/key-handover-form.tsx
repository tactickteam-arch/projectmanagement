"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client-api";

export function KeyHandoverForm({
  storeId,
  initial,
  photoCount,
  minPhotos,
  isCorrection,
}: {
  storeId: string;
  initial: { handoverDate: string; receivedBy: string; premisesCondition: string; repairNotes: string };
  photoCount: number;
  minPhotos: number;
  isCorrection: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api(`/api/stores/${storeId}/key-handover`, { body: { ...v, repairNotes: v.repairNotes || null } });
      toast.success(isCorrection ? "Key handover updated; fit-out modules not yet started were rescheduled" : "Key handover recorded — fit-out modules scheduled from Day 0");
      router.push(`/stores/${storeId}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ ...err.fieldErrors, _: err.message });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="hd">Handover date</Label>
        <Input id="hd" type="date" required value={v.handoverDate} onChange={(e) => setV({ ...v, handoverDate: e.target.value })} />
        {errors.handoverDate && <p className="text-xs text-destructive">{errors.handoverDate}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rb">Received by</Label>
        <Input id="rb" required value={v.receivedBy} onChange={(e) => setV({ ...v, receivedBy: e.target.value })} />
        {errors.receivedBy && <p className="text-xs text-destructive">{errors.receivedBy}</p>}
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Condition of premises</span>
        <div className="flex gap-2" role="radiogroup" aria-label="Condition of premises">
          {["Good", "Needs repair"].map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={v.premisesCondition === c}
              onClick={() => setV({ ...v, premisesCondition: c })}
              className={`h-11 flex-1 rounded-md border text-sm font-medium ${v.premisesCondition === c ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}
            >
              {c}
            </button>
          ))}
        </div>
        {errors.premisesCondition && <p className="text-xs text-destructive">{errors.premisesCondition}</p>}
      </div>
      {v.premisesCondition === "Needs repair" && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rn">What needs repair?</Label>
          <Textarea id="rn" value={v.repairNotes} onChange={(e) => setV({ ...v, repairNotes: e.target.value })} rows={3} />
          {errors.repairNotes && <p className="text-xs text-destructive">{errors.repairNotes}</p>}
        </div>
      )}
      <div className="sm:col-span-2">
        <p className={`mb-2 text-sm ${photoCount >= minPhotos ? "text-emerald-700" : "text-muted-foreground"}`}>
          Handover photos: {photoCount} of {minPhotos} required{photoCount < minPhotos ? " — upload them on the right first." : " ✓"}
        </p>
        {errors._ && <p className="mb-2 text-sm text-destructive">{errors._}</p>}
        <Button type="submit" disabled={busy} className="h-11 w-full sm:w-auto">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} {isCorrection ? "Update key handover" : "Record key handover"}
        </Button>
      </div>
    </form>
  );
}
