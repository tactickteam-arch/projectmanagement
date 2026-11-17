"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIA_STATES } from "@/lib/india-states";
import { OVERALL_STATUS_LABELS, OVERALL_STATUS_ORDER } from "@/lib/status";

const ALL = "__all";

export function DashboardFilters({ owners, cities }: { owners: { id: string; name: string }[]; cities: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== ALL) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) set("q", q.trim() || null);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["q", "state", "city", "status", "ownerId", "launchMonth"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or name" className="pl-8" aria-label="Search by store code or name" />
      </div>
      <FilterSelect label="State" value={params.get("state")} onChange={(v) => set("state", v)} options={INDIA_STATES.map((s) => ({ value: s.code, label: s.name }))} />
      <FilterSelect label="City" allLabel="All cities" value={params.get("city")} onChange={(v) => set("city", v)} options={cities.map((c) => ({ value: c, label: c }))} />
      <FilterSelect
        label="Status"
        allLabel="All statuses"
        value={params.get("status")}
        onChange={(v) => set("status", v)}
        options={[{ value: "NONE", label: "Location filing" }, ...OVERALL_STATUS_ORDER.map((s) => ({ value: s, label: OVERALL_STATUS_LABELS[s] }))]}
      />
      <FilterSelect label="Store owner" value={params.get("ownerId")} onChange={(v) => set("ownerId", v)} options={owners.map((o) => ({ value: o.id, label: o.name }))} />
      <FilterSelect label="Launch month" allLabel="Any launch month" value={params.get("launchMonth")} onChange={(v) => set("launchMonth", v)} options={launchMonths()} />
      <FilterSelect
        label="Sort"
        value={params.get("sort")}
        onChange={(v) => set("sort", v)}
        allLabel="Sort: store code"
        options={[
          { value: "name", label: "Sort: name" },
          { value: "progress", label: "Sort: progress" },
          { value: "launch", label: "Sort: target launch" },
          { value: "overdue", label: "Sort: most overdue" },
        ]}
      />
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.push(pathname, { scroll: false });
          }}
        >
          <X className="size-4" /> Clear
        </Button>
      )}
    </div>
  );
}

/** Launch-month choices: 3 months back to 12 months ahead. */
function launchMonths(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 16 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 3 + i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `Launch: ${d.toLocaleString("en-IN", { month: "short", year: "numeric" })}`,
    };
  });
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-36" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel ?? `All ${label.toLowerCase()}s`}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
