"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";

const INDIA: [number, number] = [21.5, 79];

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

/** Spec: "map pin picker" — Leaflet + OpenStreetMap (free). Click or tap to drop the pin. */
export default function MapPicker({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void }) {
  const has = lat !== null && lng !== null;
  return (
    <MapContainer center={has ? [lat, lng] : INDIA} zoom={has ? 15 : 5} className="h-72 w-full rounded-md border" scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickHandler onPick={onPick} />
      {has && <CircleMarker center={[lat, lng]} radius={9} pathOptions={{ color: "#b91c1c", fillColor: "#dc2626", fillOpacity: 0.9, weight: 2 }} />}
    </MapContainer>
  );
}
