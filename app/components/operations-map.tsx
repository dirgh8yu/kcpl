"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { createNepalBoundaryPath, nepalBoundarySource } from "../nepal-boundary";
import { customsCoverageLocations, networkLocations, networkRoutes, type NetworkLocation } from "../network-data";

type Position = { x: number; y: number };
type Bounds = { west: number; east: number; south: number; north: number };

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
    <a className="satellite-credit" href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/" target="_blank" rel="noreferrer">Satellite imagery: NASA Blue Marble / MODIS</a>
  </div>;
}

export function NepalOperationsMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const inView = useInView(mapRef, { once: true, amount: .18 });
  const [activeId, setActiveId] = useState("kathmandu");
  const activeLocation = networkLocations.find((location) => location.id === activeId) ?? networkLocations[0];
  const positions = useMemo(() => Object.fromEntries(networkLocations.map((location) => [location.id, project(location.longitude, location.latitude, REGIONAL.width, REGIONAL.height, REGIONAL.bounds)])) as Record<string, Position>, []);
  const activeRouteIds = new Set(networkRoutes.filter((route) => route.from === activeId || route.to === activeId).map((route) => route.id));

  function selectLocation(location: NetworkLocation) {
    setActiveId(location.id);
  }

  return <div ref={mapRef} className="regional-satellite-shell">
    <div className="regional-satellite-map">
      <SatelliteImage src="/images/nepal-satellite-nasa.jpg" alt="Satellite view of Nepal, the Himalayas and northern India" inView={inView} reducedMotion={reducedMotion}/>
      <div className="satellite-tone satellite-tone-regional" aria-hidden="true"/>
      <svg className="satellite-overlay" viewBox={`0 0 ${REGIONAL.width} ${REGIONAL.height}`} role="img" aria-labelledby="regional-map-title regional-map-description">
        <title id="regional-map-title">KCPL Nepal and India operations map</title>
        <desc id="regional-map-description">Satellite map showing verified KCPL locations at Kathmandu, Birgunj, Nepalgunj, Surkhet, Raxaul and Kolkata.</desc>
        <motion.path
          className="satellite-country-boundary"
          d={NEPAL_BOUNDARY_PATH}
          pathLength="1"
          initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: inView ? 1 : 0, opacity: inView ? 1 : 0 }}
          transition={{ duration: reducedMotion ? 0 : 1.35, delay: reducedMotion ? 0 : .25, ease: [0.65, 0, 0.35, 1] }}
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
          return <motion.button
            type="button"
            key={location.id}
            className={`satellite-marker ${isActive ? "is-active" : ""} ${!isRelated ? "is-muted" : ""} ${location.id === "raxaul" ? "label-low" : ""}`}
            style={{ left: `${point.x / REGIONAL.width * 100}%`, top: `${point.y / REGIONAL.height * 100}%` }}
            aria-label={`${location.name}, ${location.country}. ${location.displayLabel}. ${location.description}`}
            onMouseEnter={() => selectLocation(location)}
            onFocus={() => selectLocation(location)}
            onClick={() => selectLocation(location)}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: inView ? 1 : 0 }}
            transition={{ duration: reducedMotion ? 0 : .35, delay: reducedMotion ? 0 : .55 + index * .11 }}
          >
            <span className="satellite-marker-ring"/>
            <span className="satellite-marker-core"/>
            <span className={`satellite-marker-copy ${labelOnLeft ? "label-left" : ""}`}>
              <strong className="satellite-marker-label">{location.name}</strong>
              <small className="satellite-marker-role">{location.displayLabel}</small>
            </span>
          </motion.button>;
        })}
      </div>
      <div className="satellite-credit">Imagery: <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/" target="_blank" rel="noreferrer">NASA</a> · Boundary: <a href={nepalBoundarySource} target="_blank" rel="noreferrer">geoBoundaries / Open Data Nepal</a></div>
    </div>

    <aside className="satellite-location-panel" aria-live="polite">
      <p className="eyebrow text-gold">{activeLocation.displayLabel}</p>
      <h3>{activeLocation.name}</h3>
      <p className="satellite-location-country">{activeLocation.country}</p>
      <p className="satellite-location-description">{activeLocation.description}</p>
      {activeLocation.address && <p className="satellite-location-address">{activeLocation.address}</p>}
      <Link href="#confirmed-locations" className="satellite-location-link">View confirmed locations <span aria-hidden="true">→</span></Link>
    </aside>

    <div className="satellite-legend" aria-label="Map legend">
      <span><i className="satellite-legend-branch"/>KCPL branch / office</span>
      <span><i className="satellite-legend-customs"/>Customs coverage / operational presence</span>
      <small>{customsCoverageLocations.length ? `${customsCoverageLocations.length} verified customs points` : "Individual customs points are not plotted until verified."}</small>
    </div>

    <ul className="sr-only">
      {networkLocations.map((location) => <li key={location.id}>{location.name}, {location.country}: {location.displayLabel}. {location.description}</li>)}
      <li>KCPL also has personnel coverage across Nepal customs entry points. Individual customs locations are not plotted until verified.</li>
    </ul>
  </div>;
}
