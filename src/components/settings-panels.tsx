"use client";

import { KeyRound, Loader2, Plus, Users, UserCheck, UserX } from "lucide-react";
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
import { STORE_OWNER_TEAM, TEAM_KEYS, teamLabel, teamsLabel } from "@/lib/teams";

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "SuperAdmin (HQ)", REGIONAL_MANAGER: "Regional Manager", STORE_OWNER: "Store Owner", TEAM_MEMBER: "Sangeetha team" };

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  regionStates: string[];
  teams: string[];
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
              <th className="px-4 py-2.5 font-medium">Role · teams</th>
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
                <td className="px-4 py-2.5">
                  {ROLE_LABEL[u.role] ?? u.role}
                  {u.teams.length > 0 && <p className="text-xs text-muted-foreground">{teamsLabel(u.teams)}</p>}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {u.role === "STORE_OWNER"
                    ? `${u.stores} store${u.stores === 1 ? "" : "s"}`
                    : u.role === "REGIONAL_MANAGER"
                      ? u.regionStates.join(", ") || "—"
                      : u.role === "TEAM_MEMBER" && u.regionStates.length
                        ? u.regionStates.join(", ")
                        : "All stores"}
                </td>
                <td className="px-4 py-2.5">
                  <span className={u.isActive ? "text-emerald-700" : "text-muted-foreground"}>{u.isActive ? "Active" : "Deactivated"}</span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    {u.role !== "STORE_OWNER" && <TeamsDialog user={u} />}
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
  const [teams, setTeams] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    try {
      await api("/api/admin/users", {
        body: { name: f.get("name"), email: f.get("email"), phone: f.get("phone") || null, role, regionStates: regions, teams: role === "STORE_OWNER" ? [] : teams, password: f.get("password") },
      });
      toast.success("User created");
      setOpen(false);
      setRegions([]);
      setTeams([]);
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
                <SelectItem value="TEAM_MEMBER">Sangeetha team (department)</SelectItem>
                <SelectItem value="REGIONAL_MANAGER">Regional Manager</SelectItem>
                <SelectItem value="SUPER_ADMIN">SuperAdmin (HQ)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role !== "STORE_OWNER" && (
            <div className="space-y-1.5">
              <Label>Teams{role === "TEAM_MEMBER" ? " (at least one)" : " (optional)"}</Label>
              <TeamPicker value={teams} onChange={setTeams} />
              {errors.teams && <p className="text-xs text-destructive">{errors.teams}</p>}
            </div>
          )}
          {(role === "REGIONAL_MANAGER" || role === "TEAM_MEMBER") && (
            <div className="space-y-1.5">
              <Label>Region (states){role === "TEAM_MEMBER" ? " — leave empty for all India" : ""}</Label>
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

function TeamPicker({ value, onChange, includeOwner }: { value: string[]; onChange: (v: string[]) => void; includeOwner?: boolean }) {
  const keys = includeOwner ? [STORE_OWNER_TEAM, ...TEAM_KEYS] : TEAM_KEYS;
  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
      {keys.map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={value.includes(t)}
          onClick={() => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t])}
          className={`rounded-full border px-2 py-0.5 text-xs ${value.includes(t) ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}
        >
          {teamLabel(t)}
        </button>
      ))}
    </div>
  );
}

function TeamsDialog({ user }: { user: UserRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState(user.teams);
  const [regions, setRegions] = useState(user.regionStates);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: { teams, ...(user.role === "TEAM_MEMBER" ? { regionStates: regions } : {}) } });
      toast.success(`Teams updated for ${user.name}`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update teams");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Users className="size-4" /> Teams
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Teams for {user.name}</DialogTitle>
          <DialogDescription>Teams decide which launch steps this person fills in and approves (see Steps &amp; approvals).</DialogDescription>
        </DialogHeader>
        <TeamPicker value={teams} onChange={setTeams} />
        {user.role === "TEAM_MEMBER" && (
          <div className="space-y-1.5">
            <Label>Region (states) — leave empty for all India</Label>
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
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
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

const ANCHOR_LABEL = { created: "Store created (week 1)", expectedKey: "Expected keys (T-)", handover: "Key handover (Day 0)" } as const;

export function SchedulingPanel({
  templates,
  targetLaunchOffsetDays,
}: {
  templates: { moduleType: string; displayName: string; code: string; anchor: "created" | "expectedKey" | "handover"; defaultStartOffsetDays: number | null; defaultDurationDays: number | null }[];
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
      toast.success("Schedule saved. It applies to stores and key handovers from now on.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Defaults follow the 13-week chart (SOP slide 10). Each step is planned from its anchor: the day the store is created (week 1), the expected key date from MOU point 11 (negative = days before the keys), or the accepted key handover (Day 0).</p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Step</th>
              <th className="px-4 py-2.5 font-medium">Counted from</th>
              <th className="px-4 py-2.5 font-medium">Planned start (day)</th>
              <th className="px-4 py-2.5 font-medium">Duration (days)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.moduleType} className="border-b">
                <td className="px-4 py-2">
                  <span className="mr-1.5 font-mono text-xs text-muted-foreground">{r.code}</span>
                  {r.displayName}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{ANCHOR_LABEL[r.anchor]}</td>
                <td className="px-4 py-2">
                  <Input type="number" min={-365} max={365} className="w-24" value={r.defaultStartOffsetDays ?? 0} aria-label={`${r.displayName} start offset`} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, defaultStartOffsetDays: Number(e.target.value) } : x)))} />
                </td>
                <td className="px-4 py-2">
                  <Input type="number" min={0} className="w-24" value={r.defaultDurationDays ?? 0} aria-label={`${r.displayName} duration`} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, defaultDurationDays: Number(e.target.value) } : x)))} />
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-4 py-2 font-medium">Target soft launch</td>
              <td className="px-4 py-2 text-xs text-muted-foreground">{ANCHOR_LABEL.handover}</td>
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

export interface StepRow {
  moduleType: string;
  displayName: string;
  code: string;
  editTeams: string[];
  approverTeam: string | null;
}

/** Who fills in each launch step and who approves it (defaults come from the launch flow). */
export function StepsPanel({ steps }: { steps: StepRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(steps);
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<StepRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    try {
      for (const r of rows) {
        const orig = steps.find((x) => x.moduleType === r.moduleType);
        if (orig && JSON.stringify(orig.editTeams) === JSON.stringify(r.editTeams) && orig.approverTeam === r.approverTeam) continue;
        await api(`/api/admin/module-templates/${r.moduleType}`, { method: "PATCH", body: { editTeams: r.editTeams, approverTeam: r.approverTeam } });
      }
      toast.success("Steps saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Defaults follow the SOP (slides 2–9). “Store owner” means the store&apos;s assigned owner. A step without an approver turns green as soon as its team marks it done. HQ (SuperAdmin) can always fill in and approve any step.
      </p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Step</th>
              <th className="px-4 py-2.5 font-medium">Filled in by</th>
              <th className="px-4 py-2.5 font-medium">Approved by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.moduleType} className="border-b align-top last:border-0">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <span className="mr-1.5 font-mono text-xs text-muted-foreground">{r.code}</span>
                  {r.displayName}
                </td>
                <td className="px-4 py-3">
                  <TeamPicker value={r.editTeams} onChange={(v) => set(i, { editTeams: v })} includeOwner />
                </td>
                <td className="px-4 py-3">
                  <Select value={r.approverTeam ?? "NONE"} onValueChange={(v) => set(i, { approverTeam: v === "NONE" ? null : v })}>
                    <SelectTrigger className="w-56" aria-label={`Approver of ${r.displayName}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">No approval — team marks it done</SelectItem>
                      {TEAM_KEYS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {teamLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button onClick={save} disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} Save steps
      </Button>
    </div>
  );
}

/** Default rows of the checklists inside steps (8-point landlord check, 8-point handover check, branding items). */
export function ChecklistsPanel({ checklists }: { checklists: { moduleType: string; stepName: string; fieldKey: string; label: string; items: string[] }[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {checklists.map((c) => (
        <ChecklistEditor key={`${c.moduleType}.${c.fieldKey}`} {...c} />
      ))}
    </div>
  );
}

function ChecklistEditor({ moduleType, stepName, fieldKey, label, items }: { moduleType: string; stepName: string; fieldKey: string; label: string; items: string[] }) {
  const router = useRouter();
  const [text, setText] = useState(items.join("\n"));
  const [busy, setBusy] = useState(false);
  const id = `cl-${moduleType}-${fieldKey}`;
  async function save() {
    setBusy(true);
    try {
      const list = text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      await api(`/api/admin/module-templates/${moduleType}`, { method: "PATCH", body: { checklistItems: { [fieldKey]: list } } });
      toast.success(`${label} saved. Stores that have not started this step get the new list.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} <span className="font-normal text-muted-foreground">· {stepName} · one per line</span>
      </Label>
      <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={9} />
      <Button onClick={save} disabled={busy} size="sm">
        {busy && <Loader2 className="size-4 animate-spin" />} Save
      </Button>
    </div>
  );
}
