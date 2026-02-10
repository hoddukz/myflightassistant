// Tag: core
// Path: /Users/hodduk/Documents/git/mfa/frontend/src/components/briefing/RouteMap.tsx

"use client";

import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Polygon,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";

interface PointInfo {
  lat: number;
  lon: number;
  label: string;
}

interface PolygonInfo {
  coords: { lat: number; lon: number }[];
  type: "SIGMET" | "AIRMET";
  hazard: string;
}

interface RouteMapProps {
  origin: PointInfo;
  destination: PointInfo;
  polygons: PolygonInfo[];
}

function FitBoundsHelper({
  origin,
  destination,
  polygons,
}: {
  origin: PointInfo;
  destination: PointInfo;
  polygons: PolygonInfo[];
}) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;

    const allPoints: LatLngTuple[] = [
      [origin.lat, origin.lon],
      [destination.lat, destination.lon],
    ];
    for (const p of polygons) {
      for (const c of p.coords) {
        allPoints.push([c.lat, c.lon]);
      }
    }

    if (allPoints.length >= 2) {
      const bounds: LatLngBoundsExpression = allPoints as LatLngBoundsExpression;
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, origin, destination, polygons]);

  return null;
}

export default function RouteMap({ origin, destination, polygons }: RouteMapProps) {
  const routeLine: LatLngTuple[] = [
    [origin.lat, origin.lon],
    [destination.lat, destination.lon],
  ];

  const center: LatLngTuple = [
    (origin.lat + destination.lat) / 2,
    (origin.lon + destination.lon) / 2,
  ];

  return (
    <div className="rounded-lg overflow-hidden border border-zinc-700" style={{ height: 200 }}>
      <MapContainer
        center={center}
        zoom={4}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <FitBoundsHelper origin={origin} destination={destination} polygons={polygons} />

        {/* Route line */}
        <Polyline positions={routeLine} color="#3b82f6" weight={2} opacity={0.8} />

        {/* Origin marker */}
        <CircleMarker
          center={[origin.lat, origin.lon]}
          radius={5}
          fillColor="#3b82f6"
          fillOpacity={1}
          color="#3b82f6"
          weight={1}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            <span className="font-mono text-xs font-bold">{origin.label}</span>
          </Tooltip>
        </CircleMarker>

        {/* Destination marker */}
        <CircleMarker
          center={[destination.lat, destination.lon]}
          radius={5}
          fillColor="#f59e0b"
          fillOpacity={1}
          color="#f59e0b"
          weight={1}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            <span className="font-mono text-xs font-bold">{destination.label}</span>
          </Tooltip>
        </CircleMarker>

        {/* SIGMET/AIRMET polygons */}
        {polygons.map((p, i) => {
          const positions: LatLngTuple[] = p.coords.map((c) => [c.lat, c.lon]);
          const isSigmet = p.type === "SIGMET";
          return (
            <Polygon
              key={i}
              positions={positions}
              pathOptions={{
                fillColor: isSigmet ? "#ef4444" : "#f59e0b",
                fillOpacity: isSigmet ? 0.25 : 0.2,
                color: isSigmet ? "#ef4444" : "#f59e0b",
                weight: 1,
                opacity: 0.6,
              }}
            >
              <Tooltip>
                <span className="text-xs font-mono">
                  {p.type}: {p.hazard}
                </span>
              </Tooltip>
            </Polygon>
          );
        })}
      </MapContainer>
    </div>
  );
}
