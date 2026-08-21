"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createNepalBoundaryPath, nepalBoundarySource } from "../nepal-boundary";
import { customsCoverageLocations, networkLocations, networkRoutes, type NetworkLocation } from "../network-data";

type Position = { x: number; y: number };
type Bounds = { west: number; east: number; south: number; north: number };
type OperationalActivity = Record<string, { active: number; exceptions: number }>;
type SearchIndexItem = { kind: "shipment" | "customer" | "enquiry"; currentLocation?: string | null; exception?: boolean };

const WORLD = { width: 1600, height: 800, bounds: { west: -180, east: 180, south: -90, north: 90 } } as const;
const REGIONAL = { width: 1200, height: 900, bounds: { west: 76, east: 90, south: 21, north: 31.5 } } as const;
const NEPAL_BOUNDARY_PATH = createNepalBoundaryPath(REGIONAL.width, REGIONAL.height, REGIONAL.bounds);

function project(longitude: number, latitude: number, width: number, height: number, bounds: Bounds): Position {
  return {
    x: Number((((longitude - bounds.west) / (bounds.east - bounds.west)) * width).toFixed(3)),
    y: Number((((bounds.north - latitude) / (bounds.north - bounds.south)) * height).toFixed(3)),
  };
}

function curvedRoute(from: Position, to: Position) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = Math.min(55, Math.max(14, distance * .1));
  const controlX = (from.x + to.x) / 2;
  const controlY = (from.y + to.y) / 2 - lift;
  return `M${from.x},${from.y} Q${controlX.toFixed(3)},${controlY.toFixed(3)} ${to.x},${to.y}`;
}

function SatelliteImage({ src, alt, inView, reducedMotion }: { src: string; alt: string; inView: boolean; reducedMotion: boolean | null }) {
  return <motion.div
    className="satellite-image"
    initial={reducedMotion ? false : { opacity: 0, scale: 1.025 }}
    animate={{ opacity: inView ? 1 : 0, scale: inView ? 1 : 1.025 }}
    transition={{ duration: reducedMotion ? 0 : 1.05, ease: [0.22, 1, 0.36, 1] }}
  >
    <Image src={src} alt={alt} fill sizes="(max-width: 767px) 100vw, 1200px" className="object-cover"/>
  </motion.div>;
}

export function WorldNetworkMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const inView = useInView(mapRef, { once: true, amount: .25 });
  const kathmandu = networkLocations[0];
  const origin = project(kathmandu.longitude, kathmandu.latitude, WORLD.width, WORLD.height, WORLD.bounds);

  return <div ref={mapRef} className="world-satellite-map">
    <SatelliteImage src="/images/world-satellite-nasa.jpg" alt="Satellite view of the world showing continents, oceans and mountain ranges" inView={inView} reducedMotion={reducedMotion}/>
    <div className="satellite-tone" aria-hidden="true"/>
    <svg className="satellite-overlay" viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} role="img" aria-labelledby="world-map-title world-map-description">
      <title id="world-map-title">KCPL world network origin</title>
      <desc id="world-map-description">A satellite map of the world marking Nepal as KCPL&apos;s origin. No unverified overseas locations are displayed.</desc>
      <motion.g className="world-origin" initial={reducedMotion ? false : { opacity: 0, scale: .8 }} animate={{ opacity: inView ? 1 : 0, scale: inView ? 1 : .8 }} transition={{ duration: reducedMotion ? 0 : .5, delay: reducedMotion ? 0 : .65 }} style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}>
        <circle className="world-origin-ring" cx={origin.x} cy={origin.y} r="18"/>
        <circle className="world-origin-core" cx={origin.x} cy={origin.y} r="6"/>
        <text className="world-origin-label" x={origin.x + 25} y={origin.y - 5}>NEPAL</text>
        <text className="world-origin-subtitle" x={origin.x + 25} y={origin.y + 15}>KCPL ORIGIN</text>
      </motion.g>
    </svg>
    <div className="world-map-caption">
      <p>Nepal is the confirmed origin. Overseas counterpart locations will be added only after verification.</p>
    </div>
    <a className="satellite-credit" href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/" target="_blank" rel="noopener noreferrer">Satellite imagery: NASA Blue Marble / MODIS</a>
  </div>;
}

export function NepalOperationsMap({ variant = "default", locationLinkHref = "#confirmed-locations" }: { variant?: "default" | "home"; locationLinkHref?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const inView = useInView(mapRef, { once: true, amount: .18 });
  const [activeId, setActiveId] = useState("kathmandu");
  const [activity, setActivity] = useState<OperationalActivity>({});
  const activeLocation = networkLocations.find((location) => location.id === activeId) ?? networkLocations[0];
  const positions = useMemo(() => Object.fromEntries(networkLocations.map((location) => [location.id, project(location.longitude, location.latitude, REGIONAL.width, REGIONAL.height, REGIONAL.bounds)])) as Record<string, Position>, []);
  const activeRouteIds = new Set(networkRoutes.filter((route) => route.from === activeId || route.to === activeId).map((route) => route.id));

  useEffect(() => {
    if (variant !== "home") return;
    const controller = new AbortController();
    fetch("/api/admin/search", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { results?: SearchIndexItem[] };
        if (!response.ok || !data.results) return;
        const shipments = data.results.filter((item) => item.kind === "shipment" && item.currentLocation);
        const next = Object.fromEntries(networkLocations.map((location) => {
          const locationName = location.name.toLowerCase();
          const matching = shipments.filter((item) => item.currentLocation?.toLowerCase().includes(locationName));
          return [location.id, { active: matching.length, exceptions: matching.filter((item) => item.exception).length }];
        })) as OperationalActivity;
        setActivity(next);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [variant]);

  function selectLocation(location: NetworkLocation) {
    setActiveId(location.id);
  }

  const activeSignal = activity[activeLocation.id];
  const activityCount = Object.values(activity).reduce((sum, signal) => sum + signal.active, 0);

  return <div ref={mapRef} className={`regional-satellite-shell ${variant === "home" ? "regional-satellite-shell-home" : ""}`}>
    <div className="regional-satellite-map">
      <SatelliteImage src="/images/nepal-satellite-nasa-regional.jpg" alt="Satellite view of Nepal, the Himalayas and northern India" inView={inView} reducedMotion={reducedMotion}/>
      <div className="satellite-tone satellite-tone-regional" aria-hidden="true"/>
      <svg className="satellite-overlay" viewBox={`0 0 ${REGIONAL.width} ${REGIONAL.height}`} role="img" aria-labelledby="regional-map-title regional-map-description">
        <title id="regional-map-title">KCPL Nepal and India operations map</title>
        <desc id="regional-map-description">Satellite map showing verified KCPL locations at Kathmandu, Birgunj, Nepalgunj, Surkhet, Raxaul and Kolkata. In Operations Home, badges reflect shipment locations recorded in KCPL, not GPS tracking.</desc>
        <motion.path
          className="satellite-country-boundary"
          d={NEPAL_BOUNDARY_PATH}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: inView ? 1 : 0 }}
          transition={{ duration: reducedMotion ? 0 : .7, delay: reducedMotion ? 0 : .2, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        />
        <g className="satellite-routes" aria-hidden="true">
          {networkRoutes.map((route, index) => {
            const isActive = activeRouteIds.has(route.id);
            return <motion.path
              key={route.id}
              d={curvedRoute(positions[route.from], positions[route.to])}
              className={`satellite-route ${isActive ? "is-active" : ""} ${activeId && !isActive ? "is-muted" : ""}`}
              initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: inView ? 1 : 0, opacity: inView ? 1 : 0 }}
              transition={{ duration: reducedMotion ? 0 : .75, delay: reducedMotion ? 0 : .9 + index * .16, ease: [0.65, 0, 0.35, 1] }}
            />;
          })}
        </g>
      </svg>
      <div className="satellite-markers-html">
        {networkLocations.map((location, index) => {
          const point = positions[location.id];
          const isActive = activeId === location.id;
          const isRelated = isActive || networkRoutes.some((route) => activeRouteIds.has(route.id) && (route.from === location.id || route.to === location.id));
          const labelOnLeft = location.id === "kolkata" || location.id === "raxaul";
          const signal = activity[location.id];
          return <motion.button
            type="button"
            key={location.id}
            className={`satellite-marker ${isActive ? "is-active" : ""} ${!isRelated ? "is-muted" : ""} ${location.id === "raxaul" ? "label-low" : ""}`}
            style={{ left: `${point.x / REGIONAL.width * 100}%`, top: `${point.y / REGIONAL.height * 100}%` }}
            aria-label={`${location.name}, ${location.country}. ${location.displayLabel}. ${location.description}${signal?.active ? ` ${signal.active} active shipment movements currently record this location.` : ""}`}
            onMouseEnter={() => selectLocation(location)}
            onFocus={() => selectLocation(location)}
            onClick={() => selectLocation(location)}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: inView ? 1 : 0 }}
            transition={{ duration: reducedMotion ? 0 : .35, delay: reducedMotion ? 0 : .55 + index * .11 }}
          >
            <span className="satellite-marker-ring"/>
            <span className="satellite-marker-core"/>
            {signal?.active ? <span className={`satellite-marker-activity ${signal.exceptions ? "has-exception" : ""}`} title={`${signal.active} active movement${signal.active === 1 ? "" : "s"} recorded at ${location.name}`}>{signal.active}</span> : null}
            <span className={`satellite-marker-copy ${labelOnLeft ? "label-left" : ""}`}>
              <strong className="satellite-marker-label">{location.name}</strong>
              <small className="satellite-marker-role">{location.displayLabel}</small>
            </span>
          </motion.button>;
        })}
      </div>
      <div className="satellite-credit">Imagery: <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/" target="_blank" rel="noopener noreferrer">NASA</a> · Boundary: <a href={nepalBoundarySource} target="_blank" rel="noopener noreferrer">geoBoundaries / Open Data Nepal</a></div>
    </div>

    <aside className="satellite-location-panel" aria-live="polite">
      <p className="eyebrow text-gold">{activeLocation.displayLabel}</p>
      <h3>{activeLocation.name}</h3>
      <p className="satellite-location-country">{activeLocation.country}</p>
      <p className="satellite-location-description">{activeLocation.description}</p>
      {variant === "home" && activeSignal?.active ? <p className="satellite-location-activity"><strong>{activeSignal.active}</strong> active movement{activeSignal.active === 1 ? "" : "s"} record this location{activeSignal.exceptions ? ` · ${activeSignal.exceptions} exception${activeSignal.exceptions === 1 ? "" : "s"}` : ""}</p> : null}
      {variant === "home" && activityCount > 0 ? <p className="mt-2 text-[8px] leading-4 text-[#998e85]">Operational overlay uses KCPL&apos;s recorded current-location field. It is not GPS tracking.</p> : null}
      {activeLocation.address && <p className="satellite-location-address">{activeLocation.address}</p>}
      <Link href={locationLinkHref} className="satellite-location-link">View confirmed locations <span aria-hidden="true">→</span></Link>
    </aside>

    <div className="satellite-mobile-location-tabs" aria-label="Choose a KCPL location">
      {networkLocations.map((location) => <button type="button" key={location.id} aria-pressed={activeId === location.id} onClick={() => selectLocation(location)}>{location.name}{activity[location.id]?.active ? ` · ${activity[location.id].active}` : ""}</button>)}
    </div>

    <div className="satellite-legend" aria-label="Map legend">
      <span><i className="satellite-legend-branch"/>KCPL branch / office</span>
      <span><i className="satellite-legend-customs"/>Customs coverage / operational presence</span>
      {variant === "home" ? <span><i className="satellite-legend-live"/>Recorded active movement</span> : null}
      <small>{customsCoverageLocations.length ? `${customsCoverageLocations.length} verified customs points` : "Individual customs points are not plotted until verified."}</small>
    </div>

    <ul className="sr-only">
      {networkLocations.map((location) => <li key={location.id}>{location.name}, {location.country}: {location.displayLabel}. {location.description}</li>)}
      <li>KCPL also has personnel coverage across Nepal customs entry points. Individual customs locations are not plotted until verified.</li>
    </ul>
  </div>;
}
