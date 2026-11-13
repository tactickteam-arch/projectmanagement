"use client";

import dynamic from "next/dynamic";
import type { MapStore } from "./store-map";

const StoreMap = dynamic(() => import("./store-map"), { ssr: false, loading: () => <div className="h-[70vh] min-h-96 animate-pulse rounded-lg border bg-muted" /> });

export function StoreMapLoader({ stores }: { stores: MapStore[] }) {
  return <StoreMap stores={stores} />;
}
