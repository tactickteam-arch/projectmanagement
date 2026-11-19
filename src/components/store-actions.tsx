"use client";

import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { OverallStatus } from "@/generated/prisma/enums";
import { api, ApiError } from "@/lib/client-api";

/** HQ: put a store On Hold / Dropped, or return it to automatic status. */
export function StatusOverride({ storeId, status }: { storeId: string; status: OverallStatus | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const manual = status === "ON_HOLD" || status === "DROPPED";
  async function set(value: string) {
    setBusy(true);
    try {
      await api(`/api/stores/${storeId}/status`, { body: { status: value } });
      toast.success(value === "AUTO" ? "Status returned to automatic" : "Status updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not change status");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Select value="" onValueChange={set} disabled={busy}>
      <SelectTrigger className="w-auto" size="sm" aria-label="Change overall status">
        <SelectValue placeholder={busy ? "Updating…" : "HQ status override"} />
      </SelectTrigger>
      <SelectContent>
        {status !== "ON_HOLD" && <SelectItem value="ON_HOLD">Put On Hold</SelectItem>}
        {status !== "DROPPED" && <SelectItem value="DROPPED">Mark Dropped</SelectItem>}
        {manual && <SelectItem value="AUTO">Resume (automatic status)</SelectItem>}
      </SelectContent>
    </Select>
  );
}

export interface EditableStore {
  id: string;
  name: string;
  area: string | null;
  pincode: string | null;
  address: string | null;
  storeType: "OWN" | "FRANCHISE" | null;
  carpetAreaSqft: number | null;
  floor: "GROUND" | "FIRST" | "OTHER" | null;
  targetLaunchDate: string | null;
  actualLaunchDate: string | null;
  overallStatus: OverallStatus | null;
}

/** Store owner / SuperAdmin: edit master fields (state, city and code are fixed). */
export function EditStoreDialog({ store }: { store: EditableStore }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [storeType, setStoreType] = useState(store.storeType ?? "");
  const [floor, setFloor] = useState(store.floor ?? "");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => (f.get(k) as string | null)?.trim() || null;
    const body: Record<string, unknown> = {
      name: s("name"),
      area: s("area"),
      pincode: s("pincode"),
      address: s("address"),
      storeType: storeType || null,
      floor: floor || null,
      carpetAreaSqft: s("carpetAreaSqft") ? Number(s("carpetAreaSqft")) : null,
      targetLaunchDate: s("targetLaunchDate"),
    };
    setBusy(true);
    setErrors({});
    try {
      await api(`/api/stores/${store.id}`, { method: "PATCH", body });
      toast.success("Store details saved");
      setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" /> Edit details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit store details</DialogTitle>
          <DialogDescription>State, city and store code cannot be changed after creation.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Store name" error={errors.name} className="sm:col-span-2">
            <Input name="name" defaultValue={store.name} required />
          </Field>
          <Field label="Area / locality" error={errors.area}>
            <Input name="area" defaultValue={store.area ?? ""} />
          </Field>
          <Field label="PIN code" error={errors.pincode}>
            <Input name="pincode" defaultValue={store.pincode ?? ""} inputMode="numeric" maxLength={6} />
          </Field>
          <Field label="Full address" error={errors.address} className="sm:col-span-2">
            <Textarea name="address" defaultValue={store.address ?? ""} rows={2} />
          </Field>
          <Field label="Store type">
            <Select value={storeType} onValueChange={(v) => setStoreType(v as typeof storeType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OWN">Own</SelectItem>
                <SelectItem value="FRANCHISE">Franchise</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Floor">
            <Select value={floor} onValueChange={(v) => setFloor(v as typeof floor)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GROUND">Ground</SelectItem>
                <SelectItem value="FIRST">First</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Carpet area (sq ft)" error={errors.carpetAreaSqft}>
            <Input name="carpetAreaSqft" type="number" min={1} defaultValue={store.carpetAreaSqft ?? ""} />
          </Field>
          <Field label="Target launch date" error={errors.targetLaunchDate}>
            <Input name="targetLaunchDate" type="date" defaultValue={store.targetLaunchDate ?? ""} />
          </Field>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Carpet area drives the SOP power-load and AC checks. The soft launch date is recorded by the 7 · Soft launch step.
          </p>
          {errors._ && <p className="text-sm text-destructive sm:col-span-2">{errors._}</p>}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, hint, className, children }: { label: string; error?: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
