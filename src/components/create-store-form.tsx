"use client";

import { Loader2, LocateFixed } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client-api";
import { INDIA_STATES } from "@/lib/india-states";

const MapPicker = dynamic(() => import("./map-picker"), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-md border bg-muted" /> });

export function CreateStoreForm({ owners }: { owners: { id: string; name: string; email: string }[] | null }) {
  const router = useRouter();
  const [state, setState] = useState("");
  const [storeType, setStoreType] = useState("");
  const [floor, setFloor] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("Location is not available on this device");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(Number(p.coords.latitude.toFixed(6)));
        setLng(Number(p.coords.longitude.toFixed(6)));
      },
      () => toast.error("Could not get your location. Tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => (f.get(k) as string | null)?.trim() || null;
    setBusy(true);
    setErrors({});
    try {
      const res = await api<{ id: string; storeCode: string }>("/api/stores", {
        body: {
          name: s("name") ?? "",
          state,
          city: s("city") ?? "",
          area: s("area"),
          pincode: s("pincode"),
          address: s("address"),
          lat,
          lng,
          storeType: storeType || null,
          floor: floor || null,
          carpetAreaSqft: s("carpetAreaSqft") ? Number(s("carpetAreaSqft")) : null,
          targetLaunchDate: s("targetLaunchDate"),
          ...(owners ? { ownerId: ownerId || undefined } : {}),
        },
      });
      toast.success(`Store created: ${res.storeCode}`);
      router.push(`/stores/${res.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ ...err.fieldErrors, _: err.message });
        toast.error(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Store details</CardTitle>
          <CardDescription>The store code (SGM-STATE-CITY-NNNN) is generated automatically.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Store name *</Label>
            <Input id="name" name="name" required placeholder="e.g. Sangeetha Mobiles – Indiranagar" />
            {err("name")}
          </div>
          {owners && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Store owner *</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Assign to a store owner" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} · {o.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err("ownerId")}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>State / UT *</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose state" />
              </SelectTrigger>
              <SelectContent>
                {INDIA_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("state")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City *</Label>
            <Input id="city" name="city" required />
            {err("city")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area">Area / locality</Label>
            <Input id="area" name="area" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pincode">PIN code</Label>
            <Input id="pincode" name="pincode" inputMode="numeric" maxLength={6} pattern="\d{6}" />
            {err("pincode")}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Full address</Label>
            <Textarea id="address" name="address" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Store type</Label>
            <Select value={storeType} onValueChange={setStoreType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OWN">Own</SelectItem>
                <SelectItem value="FRANCHISE">Franchise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Floor</Label>
            <Select value={floor} onValueChange={setFloor}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GROUND">Ground</SelectItem>
                <SelectItem value="FIRST">First</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="carpet">Carpet area (sq ft)</Label>
            <Input id="carpet" name="carpetAreaSqft" type="number" min={1} inputMode="numeric" />
            {err("carpetAreaSqft")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tl">Target launch date</Label>
            <Input id="tl" name="targetLaunchDate" type="date" />
            <p className="text-xs text-muted-foreground">Optional — filled from the key handover if left empty.</p>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Location pin</CardTitle>
            <CardDescription>Tap the map to drop the pin, or use your current location on site.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <MapPicker
              lat={lat}
              lng={lng}
              onPick={(a, b) => {
                setLat(a);
                setLng(b);
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground tabular-nums">{lat !== null && lng !== null ? `${lat}, ${lng}` : "No pin yet"}</span>
              <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
                <LocateFixed className="size-4" /> Use my location
              </Button>
            </div>
            {err("lat")}
            {err("lng")}
          </CardContent>
        </Card>
        {errors._ && <p className="text-sm text-destructive">{errors._}</p>}
        <Button type="submit" disabled={busy} className="h-11 w-full">
          {busy && <Loader2 className="size-4 animate-spin" />} Create store
        </Button>
      </div>
    </form>
  );
}
