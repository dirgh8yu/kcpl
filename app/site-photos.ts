import type { StaticImageData } from "next/image";
import airDusk from "../public/images/site/air-dusk.jpg";
import breakbulk from "../public/images/site/breakbulk.jpg";
import doorDelivery from "../public/images/site/door-delivery.jpg";
import himalaya from "../public/images/site/himalaya.jpg";
import mountainRoad from "../public/images/site/mountain-road.jpg";
import openTop from "../public/images/site/open-top.jpg";
import packing from "../public/images/site/packing.jpg";
import portAerial from "../public/images/site/port-aerial.jpg";
import portDusk from "../public/images/site/port-dusk.jpg";
import projectTransformer from "../public/images/site/project-transformer.jpg";
import roadDawn from "../public/images/site/road-dawn.jpg";
import roadPlains from "../public/images/site/road-plains.jpg";
import shipAerial from "../public/images/site/ship-aerial.jpg";
import warehouse from "../public/images/site/warehouse.jpg";
import warehouseAisle from "../public/images/site/warehouse-aisle.jpg";
import type { ServiceKey } from "./services-data";

/*
 * The public site's photographs: one graded set (scripts/grade-site-photos.mjs),
 * imported statically so every picture arrives with its size and a blurred
 * preview and never flashes in as a grey box. Illustrative stock, not KCPL's
 * own cargo, so each is decorative (alt="") wherever it appears.
 *
 * Each page uses a photograph once, and the home page and the services pages
 * do not share any.
 */
export const photos = {
  airDusk, breakbulk, doorDelivery, himalaya, mountainRoad, openTop, packing, portAerial,
  portDusk, projectTransformer, roadDawn, roadPlains, shipAerial, warehouse, warehouseAisle,
} satisfies Record<string, StaticImageData>;

export const servicePhotos: Record<ServiceKey, StaticImageData> = {
  air: airDusk,
  ocean: portDusk,
  road: roadPlains,
  customs: portAerial,
  project: projectTransformer,
  warehouse,
  delivery: doorDelivery,
};
