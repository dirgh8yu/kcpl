"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { networkPoints, type NetworkGroup, type NetworkPoint } from "../network-data";

type Filter = "all" | NetworkGroup;

export type NetworkMapLabels = {
  title: string;
  all: string;
  operations: string;
  gateways: string;
  origins: string;
  destinations: string;
  note: string;
  unavailable: string;
  map: string;
};

const filters: Filter[] = ["all", "operations", "gateways", "origins", "destinations"];

const views: Record<Filter, [[number, number], [number, number]]> = {
  all: [[-112, -31], [142, 61]],
  operations: [[80.6, 21.5], [89.7, 30]],
  gateways: [[82.1, 16.6], [90.1, 28.2]],
  origins: [[98.8, 0.2], [123.5, 38]],
  destinations: [[-112, -31], [142, 61]],
};

export function NetworkMap({ labels }: { labels: NetworkMapLabels }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [filter, setFilter] = useState<Filter>("operations");
  const [selectedId, setSelectedId] = useState("kathmandu");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tilesReady, setTilesReady] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const visiblePoints = networkPoints.filter((point) => filter === "all" || point.groups.includes(filter));
  const selectedPoint = networkPoints.find((point) => point.id === selectedId) ?? networkPoints[0];

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;

    void import("maplibre-gl").then(({ Map, NavigationControl, setWorkerUrl }) => {
      if (cancelled || !containerRef.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      try {
        instance = new Map({
          container: containerRef.current,
          style: "https://tiles.openfreemap.org/styles/positron",
          bounds: views.operations,
          fitBoundsOptions: { padding: 36 },
          minZoom: 0,
          maxZoom: 11,
          renderWorldCopies: false,
          scrollZoom: false,
          cooperativeGestures: false,
          dragRotate: false,
          pitchWithRotate: false,
        });
        mapRef.current = instance;
        instance.addControl(new NavigationControl({ showCompass: false }), "top-right");
        instance.on("load", () => setMapLoaded(true));
        instance.on("idle", () => setTilesReady(true));
        instance.on("error", () => {
          if (!instance?.isStyleLoaded()) setMapUnavailable(true);
        });
      } catch {
        setMapUnavailable(true);
      }
    }).catch(() => {
      if (!cancelled) setMapUnavailable(true);
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      instance?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map) return;
    let removed = false;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    void import("maplibre-gl").then(({ Marker }) => {
      if (removed) return;
      markersRef.current = visiblePoints.map((point) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `network-map-marker network-map-marker-${point.groups[0]}`;
        button.setAttribute("aria-label", `${point.name}, ${labels[point.groups[0]]}`);
        button.dataset.pointId = point.id;
        button.classList.toggle("is-selected", point.id === selectedId);
        button.addEventListener("click", () => focusPoint(point));
        return new Marker({ element: button, anchor: "center" }).setLngLat([...point.coordinates]).addTo(map);
      });
    });

    return () => {
      removed = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  // The marker event closes over the current filter's points; selection styling is updated separately.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, mapLoaded]);

  useEffect(() => {
    markersRef.current.forEach((marker) => {
      marker.getElement().classList.toggle("is-selected", marker.getElement().dataset.pointId === selectedId);
    });
  }, [selectedId, filter, mapLoaded]);

  function focusPoint(point: NetworkPoint) {
    setSelectedId(point.id);
    mapRef.current?.flyTo({
      center: [...point.coordinates],
      zoom: point.groups.includes("destinations") ? 3.5 : point.groups.includes("operations") ? 7 : 5,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 850,
      essential: false,
    });
  }

  function selectFilter(next: Filter) {
    setFilter(next);
    const points = networkPoints.filter((point) => next === "all" || point.groups.includes(next));
    setSelectedId(next === "all" ? "kathmandu" : points[0].id);
    mapRef.current?.fitBounds(views[next], {
      padding: window.innerWidth < 700 ? 28 : 48,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 750,
    });
  }

  return (
    <section className="network-map-section" aria-labelledby="network-map-title">
      <div className="network-map-heading">
        <h2 id="network-map-title">{labels.title}</h2>
        <div className="network-map-filters" role="group" aria-label={labels.title}>
          {filters.map((group) => (
            <button key={group} type="button" className="network-map-filter" aria-pressed={filter === group} onClick={() => selectFilter(group)}>{labels[group]}</button>
          ))}
        </div>
      </div>
      <div className={`network-map-stage${tilesReady ? " is-ready" : ""}`}>
        <Image src="/images/nepal-satellite-nasa-regional.jpg" alt="" fill sizes="100vw" className="network-map-fallback-image"/>
        <div ref={containerRef} className="network-map-canvas" role="group" aria-label={labels.map}/>
        {mapUnavailable && <p className="network-map-unavailable" role="status">{labels.unavailable}</p>}
        <div className="network-map-selection" aria-live="polite">
          <span>{selectedPoint.groups.map((group) => labels[group]).join(" / ")}</span>
          <strong>{selectedPoint.name}</strong>
        </div>
      </div>
      <div className="network-map-footer">
        <div className="network-map-places" role="group" aria-label={labels[filter]}>
          {visiblePoints.map((point) => <button key={point.id} type="button" aria-pressed={selectedId === point.id} onClick={() => focusPoint(point)}>{point.name}</button>)}
        </div>
        <p>{labels.note}</p>
      </div>
    </section>
  );
}
