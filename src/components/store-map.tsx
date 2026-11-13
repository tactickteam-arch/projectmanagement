"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

export interface MapStore {
  id: string;
  name: string;
  storeCode: string;
  city: string;
  lat: number;
  lng: number;
  statusLabel: string;
  color: string;
  progress: number;
}

/** Spec: "India map with a pin per store, coloured by overall status" — Leaflet + OpenStreetMap. */
export default function StoreMap({ stores }: { stores: MapStore[] }) {
  return (
    <MapContainer center={[21.5, 79]} zoom={5} className="h-[70vh] min-h-96 w-full rounded-lg border" scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {stores.map((s) => (
        <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={10} pathOptions={{ color: "#fff", weight: 2, fillColor: s.color, fillOpacity: 0.95 }}>
          <Popup>
            <div className="space-y-0.5 text-sm">
              <p className="font-semibold">{s.name}</p>
              <p className="font-mono text-xs">{s.storeCode}</p>
              <p>
                {s.city} · {s.statusLabel} · {s.progress}%
              </p>
              <Link href={`/stores/${s.id}`} className="text-primary underline">
                Open store
              </Link>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
