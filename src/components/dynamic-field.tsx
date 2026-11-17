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
    case "task":
      return (
        <label htmlFor={id} className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/60 ${disabled ? "cursor-default opacity-80" : ""}`}>
          <Checkbox id={id} checked={value === true} onCheckedChange={(c) => onChange(c === true)} disabled={disabled} className="size-5" />
          <span className={`flex-1 text-sm ${value === true ? "text-muted-foreground line-through decoration-muted-foreground/40" : ""}`}>
            {field.label}
            {field.owner && <span className="ml-2 text-xs text-muted-foreground no-underline">{field.owner}</span>}
          </span>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </label>
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

/** Empty row for a checklist: first column holds the item name, yes/no columns start unticked. */
export function checklistRow(field: FieldDef, name = ""): Record<string, unknown> {
  const cols = field.itemFields ?? [];
  return Object.fromEntries(cols.map((c, i) => [c.key, i === 0 ? name : c.type === "yesno" ? false : null]));
}

function Checklist({ field, value, onChange, disabled, error }: { field: FieldDef; value: Record<string, unknown>[] | null; onChange: (v: Value) => void; disabled?: boolean; error?: string }) {
  const cols = field.itemFields ?? [];
  const [nameCol, ...rest] = cols;
  const rows = value ?? (field.defaultItems ?? []).map((n) => checklistRow(field, n));
  const update = (i: number, patch: Record<string, unknown>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const ticked = field.mustTick ? rows.filter((r) => r[field.mustTick as string] === true).length : null;
  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="flex items-baseline justify-between gap-2 text-sm font-medium">
        {field.label}
        {ticked !== null && (
          <span className={`text-xs font-normal ${ticked === rows.length && rows.length > 0 ? "text-emerald-700" : "text-muted-foreground"}`}>
            {ticked} of {rows.length} {cols.find((c) => c.key === field.mustTick)?.label.toLowerCase() ?? "done"}
          </span>
        )}
      </span>
      <div className="divide-y rounded-md border">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-3 p-2.5">
            {nameCol && (
              <Input
                value={(r[nameCol.key] as string) ?? ""}
                onChange={(e) => update(i, { [nameCol.key]: e.target.value })}
                disabled={disabled}
                className="h-9 min-w-48 flex-1"
                aria-label={nameCol.label}
              />
            )}
            {rest.map((c) =>
              c.type === "yesno" ? (
                <label key={c.key} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={r[c.key] === true} onCheckedChange={(v) => update(i, { [c.key]: v === true })} disabled={disabled} /> {c.label}
                </label>
              ) : c.type === "number" ? (
                <Input
                  key={c.key}
                  type="number"
                  min={c.min}
                  value={r[c.key] === null || r[c.key] === undefined ? "" : String(r[c.key])}
                  onChange={(e) => update(i, { [c.key]: e.target.value === "" ? null : Number(e.target.value) })}
                  disabled={disabled}
                  className="h-9 w-20"
                  placeholder={c.label}
                  aria-label={c.label}
                />
              ) : (
                <Input
                  key={c.key}
                  value={(r[c.key] as string) ?? ""}
                  onChange={(e) => update(i, { [c.key]: e.target.value || null })}
                  disabled={disabled}
                  className="h-9 w-full sm:w-48"
                  placeholder={c.label}
                  aria-label={c.label}
                />
              ),
            )}
            {!disabled && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove ${String(r[nameCol?.key ?? ""] ?? "item")}`}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, checklistRow(field)])}>
          <Plus className="size-4" /> Add item
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
