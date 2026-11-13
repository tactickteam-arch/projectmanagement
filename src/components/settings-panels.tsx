"use client";

import { KeyRound, Loader2, Plus, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client-api";
import { INDIA_STATES } from "@/lib/india-states";

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "SuperAdmin (HQ)", REGIONAL_MANAGER: "Regional Manager", STORE_OWNER: "Store Owner" };

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  regionStates: string[];
  isActive: boolean;
  stores: number;
}

export function UsersPanel({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(u: UserRow) {
    setBusy(u.id);
    try {
      await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { isActive: !u.isActive } });
      toast.success(u.isActive ? `${u.name} deactivated` : `${u.name} activated`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update the user");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CreateUserDialog />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Stores / region</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.email}
                    {u.phone ? ` · ${u.phone}` : ""}
                  </p>
                </td>
                <td className="px-4 py-2.5">{ROLE_LABEL[u.role] ?? u.role}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {u.role === "STORE_OWNER" ? `${u.stores} store${u.stores === 1 ? "" : "s"}` : u.role === "REGIONAL_MANAGER" ? u.regionStates.join(", ") || "—" : "All stores"}
                </td>
                <td className="px-4 py-2.5">
                  <span className={u.isActive ? "text-emerald-700" : "text-muted-foreground"}>{u.isActive ? "Active" : "Deactivated"}</span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    <ResetPasswordDialog user={u} />
                    {u.id !== currentUserId && (
                      <Button size="sm" variant="outline" onClick={() => toggle(u)} disabled={busy === u.id}>
                        {busy === u.id ? <Loader2 className="size-4 animate-spin" /> : u.isActive ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                        {u.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("STORE_OWNER");
  const [regions, setRegions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    try {
      await api("/api/admin/users", {
        body: { name: f.get("name"), email: f.get("email"), phone: f.get("phone") || null, role, regionStates: regions, password: f.get("password") },
      });
      toast.success("User created");
      setOpen(false);
      setRegions([]);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors({ ...err.fieldErrors, _: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>Share the initial password with the user securely; they sign in with e-mail and password.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Name</Label>
            <Input id="u-name" name="name" required />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-email">E-mail</Label>
            <Input id="u-email" name="email" type="email" required />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-phone">Phone (optional)</Label>
            <Input id="u-phone" name="phone" type="tel" />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STORE_OWNER">Store Owner</SelectItem>
                <SelectItem value="REGIONAL_MANAGER">Regional Manager</SelectItem>
                <SelectItem value="SUPER_ADMIN">SuperAdmin (HQ)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role === "REGIONAL_MANAGER" && (
            <div className="space-y-1.5">
              <Label>Region (states)</Label>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-md border p-2">
                {INDIA_STATES.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    aria-pressed={regions.includes(s.code)}
                    onClick={() => setRegions((r) => (r.includes(s.code) ? r.filter((x) => x !== s.code) : [...r, s.code]))}
                    className={`rounded-full border px-2 py-0.5 text-xs ${regions.includes(s.code) ? "border-primary bg-primary/10 text-primary" : ""}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              {errors.regionStates && <p className="text-xs text-destructive">{errors.regionStates}</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="u-pw">Initial password</Label>
            <Input id="u-pw" name="password" type="password" minLength={8} required autoComplete="new-password" />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          {errors._ && <p className="text-sm text-destructive">{errors._}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user }: { user: UserRow }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: { password: new FormData(e.currentTarget).get("password") } });
      toast.success(`Password reset for ${user.name}`);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset the password");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <KeyRound className="size-4" /> Reset password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {user.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input name="password" type="password" minLength={8} required placeholder="New password (min. 8 characters)" autoComplete="new-password" aria-label="New password" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Reset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignmentPanel({ stores, owners }: { stores: { id: string; storeCode: string; name: string; city: string; ownerId: string }[]; owners: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function assign(storeId: string, ownerId: string) {
    setBusy(storeId);
    try {
      await api(`/api/stores/${storeId}/owner`, { method: "PATCH", body: { ownerId } });
      toast.success("Store reassigned");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not reassign");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[600px] text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Store</th>
            <th className="px-4 py-2.5 font-medium">Store owner</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => (
            <tr key={s.id} className="border-b last:border-0">
              <td className="px-4 py-2.5">
                <p className="font-medium">{s.name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {s.storeCode} · {s.city}
                </p>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Select value={s.ownerId} onValueChange={(v) => assign(s.id, v)} disabled={busy === s.id}>
                    <SelectTrigger className="w-64" aria-label={`Owner of ${s.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {busy === s.id && <Loader2 className="size-4 animate-spin" />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SchedulingPanel({
  templates,
  targetLaunchOffsetDays,
}: {
  templates: { moduleType: string; displayName: string; defaultStartOffsetDays: number | null; defaultDurationDays: number | null }[];
  targetLaunchOffsetDays: number;
}) {
  const router = useRouter();
  const scheduled = templates.filter((t) => t.defaultStartOffsetDays !== null);
  const [rows, setRows] = useState(scheduled.map((t) => ({ ...t })));
  const [target, setTarget] = useState(targetLaunchOffsetDays);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      for (const r of rows) {
        await api(`/api/admin/module-templates/${r.moduleType}`, {
          method: "PATCH",
          body: { defaultStartOffsetDays: Number(r.defaultStartOffsetDays), defaultDurationDays: Number(r.defaultDurationDays) },
        });
      }
      await api("/api/admin/module-templates", { method: "PATCH", body: { targetLaunchOffsetDays: Number(target) } });
      toast.success("Scheduling defaults saved. They apply to key handovers recorded from now on.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Days after key handover (Day 0). Values from the spec are placeholders to confirm with Sangeetha.</p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Module</th>
              <th className="px-4 py-2.5 font-medium">Planned start (day)</th>
              <th className="px-4 py-2.5 font-medium">Duration (days)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.moduleType} className="border-b">
                <td className="px-4 py-2">{r.displayName}</td>
                <td className="px-4 py-2">
                  <Input type="number" min={0} className="w-24" value={r.defaultStartOffsetDays ?? 0} aria-label={`${r.displayName} start offset`} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, defaultStartOffsetDays: Number(e.target.value) } : x)))} />
                </td>
                <td className="px-4 py-2">
                  <Input type="number" min={1} className="w-24" value={r.defaultDurationDays ?? 1} aria-label={`${r.displayName} duration`} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, defaultDurationDays: Number(e.target.value) } : x)))} />
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-4 py-2 font-medium">Target launch</td>
              <td className="px-4 py-2">
                <Input type="number" min={1} className="w-24" value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="Target launch offset" />
              </td>
              <td className="px-4 py-2 text-muted-foreground">—</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Button onClick={save} disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} Save scheduling defaults
      </Button>
    </div>
  );
}

export function BrandingItemsPanel({ items }: { items: string[] }) {
  const router = useRouter();
  const [text, setText] = useState(items.join("\n"));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const list = text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      await api("/api/admin/module-templates/INSHOP_BRANDING", { method: "PATCH", body: { brandingDefaultItems: list } });
      toast.success("Branding checklist saved. New branding forms start with these items.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-md space-y-3">
      <Label htmlFor="bi">Default branding checklist items (one per line)</Label>
      <Textarea id="bi" value={text} onChange={(e) => setText(e.target.value)} rows={8} />
      <Button onClick={save} disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} Save items
      </Button>
    </div>
  );
}
