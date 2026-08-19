"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { customsCoverageLocations, networkLocations, networkRoutes, type NetworkLocation } from "../network-data";

type Position = { x: number; y: number };
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
type BoundaryFeature = { type: "Feature"; properties: { name: string; iso_a3: string }; geometry: Geometry };
type BoundaryCollection = { type: "FeatureCollection"; source: string; features: BoundaryFeature[] };

const WIDTH = 1200;
const HEIGHT = 660;
const BOUNDS = { west: 80, east: 89.45, south: 21.55, north: 30.7 };

function mercatorLatitude(latitude: number) {
  const radians = Math.max(-85, Math.min(85, latitude)) * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function project(longitude: number, latitude: number): Position {
  const x = (longitude - BOUNDS.west) / (BOUNDS.east - BOUNDS.west) * WIDTH;
  const north = mercatorLatitude(BOUNDS.north);
  const south = mercatorLatitude(BOUNDS.south);
  const y = (north - mercatorLatitude(latitude)) / (north - south) * HEIGHT;
  return { x, y };
}

function ringPath(ring: number[][]) {
  return ring.map(([longitude, latitude], index) => {
    const point = project(longitude, latitude);
    return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).join(" ") + " Z";
}

function geometryPath(geometry: Geometry) {
  if (geometry.type === "Polygon") {
    return (geometry.coordinates as number[][][]).map(ringPath).join(" ");
  }
  return (geometry.coordinates as number[][][][]).flatMap((polygon) => polygon.map(ringPath)).join(" ");
}

function curvedRoute(from: Position, to: Position) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = Math.min(62, Math.max(16, distance * 0.12));
  const controlX = (from.x + to.x) / 2;
  const controlY = (from.y + to.y) / 2 - lift;
  return `M${from.x.toFixed(2)},${from.y.toFixed(2)} Q${controlX.toFixed(2)},${controlY.toFixed(2)} ${to.x.toFixed(2)},${to.y.toFixed(2)}`;
}

export function OperationsMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [boundaries, setBoundaries] = useState<BoundaryFeature[]>([]);
  const [activeId, setActiveId] = useState("kathmandu");
  const reduceMotion = useReducedMotion();
  const mapInView = useInView(mapRef, { once: true, amount: .16 });
  const activeLocation = networkLocations.find((location) => location.id === activeId) ?? networkLocations[0];

  useEffect(() => {
    let live = true;
    fetch("/data/kcpl-regional-boundaries.geojson")
      .then((response) => {
        if (!response.ok) throw new Error("Boundary data could not be loaded");
        return response.json() as Promise<BoundaryCollection>;
      })
      .then((data) => { if (live) setBoundaries(data.features); })
      .catch(() => { if (live) setBoundaries([]); });
    return () => { live = false; };
  }, []);

  const positions = useMemo(() => Object.fromEntries(networkLocations.map((location) => [location.id, project(location.longitude, location.latitude)])) as Record<string, Position>, []);
  const activeRouteIds = new Set(networkRoutes.filter((route) => route.from === activeId || route.to === activeId).map((route) => route.id));

  function selectLocation(location: NetworkLocation) {
    setActiveId(location.id);
  }

  return <div ref={mapRef} className="operations-map-shell">
    <div className="operations-map-frame">
      <svg className="operations-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby="operations-map-title operations-map-description">
        <title id="operations-map-title">KCPL geographic operations network</title>
        <desc id="operations-map-description">A projected geographic map showing Kathmandu, Birgunj, Nepalgunj and Surkhet in Nepal, with cross-border network locations at Raxaul and Kolkata in India.</desc>
        <defs>
          <clipPath id="map-frame-clip"><rect width={WIDTH} height={HEIGHT}/></clipPath>
          <filter id="map-marker-glow" x="-200%" y="-200%" width="400%" height="400%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <g className="map-grid" aria-hidden="true">
          {[81,83,85,87,89].map((longitude) => { const x = project(longitude, 26).x; return <line key={`lon-${longitude}`} x1={x} x2={x} y1="0" y2={HEIGHT}/>; })}
          {[22,24,26,28,30].map((latitude) => { const y = project(85, latitude).y; return <line key={`lat-${latitude}`} x1="0" x2={WIDTH} y1={y} y2={y}/>; })}
        </g>
        <g clipPath="url(#map-frame-clip)">
          {boundaries.map((feature) => {
            const isNepal = feature.properties.iso_a3 === "NPL";
            const d = geometryPath(feature.geometry);
            return <g key={feature.properties.iso_a3} className={isNepal ? "map-country map-country-nepal" : "map-country map-country-context"}>
              <motion.path d={d} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: mapInView ? 1 : 0 }} transition={{ duration: reduceMotion ? 0 : .75, delay: isNepal ? .12 : 0 }}/>
              {isNepal && <motion.path className="map-nepal-outline" d={d} fill="none" initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: mapInView ? 1 : 0, opacity: mapInView ? 1 : 0 }} transition={{ duration: reduceMotion ? 0 : .9, delay: reduceMotion ? 0 : .12, ease: [0.65,0,0.35,1] }}/>} 
            </g>;
          })}
          <text className="map-country-label map-country-label-nepal" x={project(83.2,29.5).x} y={project(83.2,29.5).y}>NEPAL</text>
          <text className="map-country-label map-country-label-india" x={project(86.8,24.1).x} y={project(86.8,24.1).y}>INDIA</text>
          <g className="map-routes" aria-hidden="true">
            {networkRoutes.map((route, index) => {
              const active = activeRouteIds.has(route.id);
              const unrelated = activeId && !active;
              const delay = route.stage === "cross-border" ? 1.65 + index * .12 : 1.2 + index * .12;
              return <motion.path key={route.id} d={curvedRoute(positions[route.from], positions[route.to])} className={`map-route ${route.stage === "cross-border" ? "map-route-cross-border" : ""} ${active ? "is-active" : ""} ${unrelated ? "is-muted" : ""}`} initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: mapInView ? 1 : 0, opacity: mapInView ? unrelated ? .28 : 1 : 0 }} transition={{ duration: reduceMotion ? 0 : .65, delay: reduceMotion ? 0 : delay, ease: [0.65,0,0.35,1] }}/>
            })}
          </g>
          <g className="map-markers">
            {networkLocations.map((location, index) => {
              const point = positions[location.id];
              const isActive = activeId === location.id;
              const isRelated = !activeId || isActive || networkRoutes.some((route) => activeRouteIds.has(route.id) && (route.from === location.id || route.to === location.id));
              const labelAnchor = location.id === "kolkata" || location.id === "raxaul" ? "end" : "start";
              const labelX = labelAnchor === "end" ? -14 : 14;
              const labelY = location.id === "raxaul" ? 18 : 4;
              const delay = location.id === "kathmandu" ? .78 : location.country === "Nepal" ? .92 + index * .12 : 1.82 + index * .12;
              return <motion.g key={location.id} className={`map-marker ${isActive ? "is-active" : ""} ${!isRelated ? "is-muted" : ""}`} role="button" tabIndex={0} aria-label={`${location.name}, ${location.country}. ${location.description}`} onMouseEnter={() => selectLocation(location)} onFocus={() => selectLocation(location)} onClick={() => selectLocation(location)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectLocation(location); } }} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: mapInView ? 1 : 0 }} transition={{ duration: reduceMotion ? 0 : .35, delay: reduceMotion ? 0 : delay }}>
                <circle cx={point.x} cy={point.y} r="24" fill="transparent"/>
                <circle className="map-marker-halo" cx={point.x} cy={point.y} r={location.type === "head-office" ? 17 : 13}/>
                <circle className="map-marker-core" cx={point.x} cy={point.y} r={location.type === "head-office" ? 7 : 5}/>
                <text className="map-location-label" x={point.x + labelX} y={point.y + labelY} textAnchor={labelAnchor}>{location.name.toUpperCase()}</text>
              </motion.g>;
            })}
          </g>
        </g>
      </svg>
      {!boundaries.length && <div className="map-loading" role="status">Loading geographic boundary data…</div>}
      <div className="map-coordinate-readout" aria-hidden="true"><span>REGIONAL FRAME / 80°E—89.45°E</span><span>PROJECTION / MERCATOR</span><span>BOUNDARY / NATURAL EARTH 1:10M</span></div>
    </div>

    <div className="operations-map-detail" aria-live="polite">
      <span className="map-detail-index">{String(networkLocations.findIndex((location) => location.id === activeLocation.id) + 1).padStart(2,"0")} / {String(networkLocations.length).padStart(2,"0")}</span>
      <p className="eyebrow text-gold">{activeLocation.type === "head-office" ? "Head office" : "Operational location"}</p>
      <h3>{activeLocation.name}</h3>
      <p className="map-detail-country">{activeLocation.country} · {activeLocation.latitude.toFixed(4)}° N / {activeLocation.longitude.toFixed(4)}° E</p>
      <p className="map-detail-copy">{activeLocation.description}</p>
      {activeLocation.address && <p className="map-detail-address">{activeLocation.address}</p>}
    </div>

    <div className="operations-map-legend" aria-label="Map legend">
      <span><i className="legend-branch"/>KCPL branch / office location</span>
      <span><i className="legend-customs"/>Customs coverage / operational presence</span>
      <small>{customsCoverageLocations.length ? `${customsCoverageLocations.length} verified customs points` : "Individual customs points will be added after location verification."}</small>
    </div>

    <p className="map-source-note">Country boundaries: Natural Earth 1:10m Admin 0 Countries. Location coordinates: GeoNames. Lines show network relationships, not precise road routing.</p>

    <ul className="sr-only">
      {networkLocations.map((location) => <li key={location.id}>{location.name}, {location.country}: {location.description} Coordinates {location.latitude}, {location.longitude}.</li>)}
      <li>KCPL also has personnel coverage across Nepal customs entry points. Individual customs locations are not plotted until verified.</li>
    </ul>
  </div>;
}
