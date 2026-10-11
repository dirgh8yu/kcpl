import type { CSSProperties } from "react";
import { routeMap, type RoutePlace } from "../route-map-data";
import { siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";

/*
 * The home page's opening picture: Asia in dots, Nepal lit, and the import
 * route KCPL plans every week drawn across it -- by sea from Shanghai through
 * Singapore to Kolkata, by rail to Birgunj, by road to Kathmandu -- with air
 * exports leaving for the world. It is the one picture no other forwarder can
 * use, because it is the shape of the business.
 *
 * Server-rendered SVG with CSS motion: no JavaScript, about 5KB of path data.
 * The route draws itself once on arrival; with reduced motion it is simply
 * there. Place names are HTML laid over the SVG so they stay legible at any
 * width and in every script.
 */

// The map's left edge on screen sits just west of Nepal, so the country the
// headline names is the first thing beside it.
const CROP = 110;
const view = { x: CROP, width: routeMap.width - CROP, height: routeMap.height };

const order: RoutePlace[] = ["shanghai", "singapore", "kolkata", "birgunj", "kathmandu"];

function position(place: RoutePlace): CSSProperties {
  const [x, y] = routeMap.places[place];
  return { left: `${((x - view.x) / view.width) * 100}%`, top: `${(y / view.height) * 100}%` };
}

export function RouteMap({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const { routes, places } = routeMap;
  return (
    <div className="route-map">
      <div className="route-map-stage" role="img" aria-label={t("home.route_label")}>
        <svg viewBox={`${view.x} 0 ${view.width} ${view.height}`} aria-hidden="true" focusable="false">
          <defs>
            {/* The sea and air lines are dashed, and a dash pattern cannot also
              * draw itself; a solid copy in a mask draws instead and uncovers them. */}
            <mask id="route-reveal-sea" maskUnits="userSpaceOnUse" x={0} y={0} width={routeMap.width} height={routeMap.height}>
              <path d={routes.sea} pathLength={1} className="route-reveal route-reveal-sea"/>
            </mask>
            <mask id="route-reveal-air" maskUnits="userSpaceOnUse" x={-200} y={-200} width={routeMap.width + 400} height={routeMap.height + 400}>
              <path d={routes.air} pathLength={1} className="route-reveal route-reveal-air"/>
            </mask>
          </defs>
          <g transform={`scale(${routeMap.grid})`}>
            <path d={routeMap.land} className="route-dots"/>
            <path d={routeMap.nepal} className="route-dots route-dots-nepal"/>
          </g>
          <path d={routes.sea} className="route-line route-sea" mask="url(#route-reveal-sea)"/>
          <path d={routes.air} className="route-line route-air" mask="url(#route-reveal-air)"/>
          <path d={routes.rail} pathLength={1} className="route-line route-rail"/>
          <path d={routes.road} pathLength={1} className="route-line route-road"/>
          {order.map((place) => (
            <circle key={place} cx={places[place][0]} cy={places[place][1]} r={place === "kathmandu" ? 6 : 4} className={`route-stop route-stop-${place}`}/>
          ))}
          <circle cx={places.kathmandu[0]} cy={places.kathmandu[1]} r={6} className="route-pulse"/>
        </svg>
        {order.map((place) => (
          <span key={place} className={`route-label route-label-${place}`} style={position(place)} aria-hidden="true">
            {t(`home.place_${place}` as SiteTextKey)}
          </span>
        ))}
      </div>
      <div className="route-legend" aria-hidden="true">
        <span className="route-key route-key-sea">{t("home.route_sea")}</span>
        <span className="route-key route-key-land">{t("home.route_rail")} / {t("home.route_road")}</span>
        <span className="route-key route-key-air">{t("home.route_air")}</span>
      </div>
    </div>
  );
}
