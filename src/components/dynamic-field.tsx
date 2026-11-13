"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FieldDef } from "@/modules/types";

type Value = unknown;

/** Renders one config-driven field (src/modules/*). File fields are handled by the uploader. */
export function DynamicField({
  field,
  value,
  onChange,
  error,
  disabled,
  idPrefix = "f",
}: {
  field: FieldDef;
  value: Value;
  onChange: (v: Value) => void;
  error?: string;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const id = `${idPrefix}-${field.key}`;
  const label = (
    <Label htmlFor={id} className="text-sm">
      {field.label}
      {field.unit && <span className="font-normal text-muted-foreground"> ({field.unit})</span>}
    </Label>
  );
  const err = error && <p className="text-xs text-destructive">{error}</p>;

  switch (field.type) {
    case "text":
    case "phone":
      return (
        <div className="space-y-1.5">
          {label}
          <Input id={id} type={field.type === "phone" ? "tel" : "text"} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
          {err}
        </div>
      );
    case "longtext":
      return (
        <div className="space-y-1.5 sm:col-span-2">
          {label}
          <Textarea id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={3} />
          {err}
        </div>
      );
    case "number":
    case "currency":
    case "percent":
      return (
        <div className="space-y-1.5">
          {label}
          <div className="relative">
            {field.type === "currency" && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">₹</span>}
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              min={field.min}
              max={field.max}
              step="any"
              value={value === null || value === undefined ? "" : String(value)}
              onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
              disabled={disabled}
              className={field.type === "currency" ? "pl-7" : undefined}
            />
            {field.type === "percent" && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">%</span>}
          </div>
          {err}
        </div>
      );
    case "date":
      return (
        <div className="space-y-1.5">
          {label}
          <Input id={id} type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)} disabled={disabled} />
          {err}
        </div>
      );
    case "yesno":
      return (
        <div className="space-y-1.5">
          <span className="text-sm font-medium">{field.label}</span>
          <div className="flex gap-2" role="radiogroup" aria-label={field.label}>
            {[
              { v: true, t: "Yes" },
              { v: false, t: "No" },
            ].map((o) => (
              <button
                key={o.t}
                type="button"
                role="radio"
                aria-checked={value === o.v}
                disabled={disabled}
                onClick={() => onChange(value === o.v ? null : o.v)}
                className={`h-10 flex-1 rounded-md border text-sm font-medium transition-colors disabled:opacity-60 ${value === o.v ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}
              >
                {o.t}
              </button>
            ))}
          </div>
          {err}
        </div>
      );
    case "select":
      return (
        <div className="space-y-1.5">
          {label}
          <Select value={(value as string) ?? ""} onValueChange={(v) => onChange(v)} disabled={disabled}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err}
        </div>
      );
    case "multiselect":
      return <MultiSelect field={field} value={(value as string[]) ?? []} onChange={onChange} disabled={disabled} error={error} />;
    case "checklist":
      return <Checklist field={field} value={(value as Record<string, unknown>[]) ?? null} onChange={onChange} disabled={disabled} error={error} />;
    case "file":
      return null;
  }
}

function MultiSelect({ field, value, onChange, disabled, error }: { field: FieldDef; value: string[]; onChange: (v: Value) => void; disabled?: boolean; error?: string }) {
  const [other, setOther] = useState("");
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  const extras = value.filter((v) => !(field.options ?? []).includes(v));
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <span className="text-sm font-medium">{field.label}</span>
      <div className="flex flex-wrap gap-2">
        {(field.options ?? []).map((o) => (
          <button
            key={o}
            type="button"
            disabled={disabled}
            aria-pressed={value.includes(o)}
            onClick={() => toggle(o)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${value.includes(o) ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}
          >
            {o}
          </button>
        ))}
        {extras.map((o) => (
          <button key={o} type="button" disabled={disabled} onClick={() => toggle(o)} className="rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm text-primary" aria-label={`Remove ${o}`}>
            {o} ×
          </button>
        ))}
      </div>
      {field.allowOther && !disabled && (
        <div className="flex gap-2">
          <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Add other…" className="max-w-60" aria-label={`Add other ${field.label}`} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => {
              const v = other.trim();
              if (v && !value.includes(v)) onChange([...value, v]);
              setOther("");
            }}
          >
            Add
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Checklist({ field, value, onChange, disabled, error }: { field: FieldDef; value: Record<string, unknown>[] | null; onChange: (v: Value) => void; disabled?: boolean; error?: string }) {
  const rows = value ?? (field.defaultItems ?? []).map((n) => ({ itemName: n, quantity: null, received: false, installed: false }));
  const update = (i: number, patch: Record<string, unknown>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="text-sm font-medium">{field.label}</span>
      <div className="divide-y rounded-md border">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-3 p-2.5">
            <Input
              value={(r.itemName as string) ?? ""}
              onChange={(e) => update(i, { itemName: e.target.value })}
              disabled={disabled}
              className="h-9 min-w-40 flex-1"
              aria-label="Item name"
            />
            <Input
              type="number"
              min={0}
              value={r.quantity === null || r.quantity === undefined ? "" : String(r.quantity)}
              onChange={(e) => update(i, { quantity: e.target.value === "" ? null : Number(e.target.value) })}
              disabled={disabled}
              className="h-9 w-20"
              placeholder="Qty"
              aria-label="Quantity"
            />
            <label className="flex items-center gap-1.5 text-sm">
              <Checkbox checked={r.received === true} onCheckedChange={(c) => update(i, { received: c === true })} disabled={disabled} /> Received
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <Checkbox checked={r.installed === true} onCheckedChange={(c) => update(i, { installed: c === true })} disabled={disabled} /> Installed
            </label>
            {!disabled && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove ${String(r.itemName ?? "item")}`}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { itemName: "", quantity: null, received: false, installed: false }])}>
          <Plus className="size-4" /> Add item
        </Button>
      )}
      <p className="text-xs text-muted-foreground">Item photos: upload them under “Branding item photos” below.</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

