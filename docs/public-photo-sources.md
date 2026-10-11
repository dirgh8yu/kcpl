# Public website photography

The public site shows illustrative photographs. They do not depict KCPL shipments, staff, or facilities, which is why every one is decorative (`alt=""`) and the footer says so.

The site never uses the originals directly. `node scripts/grade-site-photos.mjs` writes one colour-graded copy of each to `public/images/site/`, so pictures from different sources read as one shoot, and `app/site-photos.ts` imports that set. Add a photograph to the script's list, run it, then import the graded file.

Retired in October 2026 because a brand other than KCPL's was legible in them: `ship-dusk.jpg` (a CMA CGM ship), `port-crane.jpg` (another line's containers) and `air-cargo.jpg` (an airline's livery).

## Unsplash

| Original | Graded as | Photographer | Unsplash source |
| --- | --- | --- | --- |
| `public/images/unsplash/ship-aerial.jpg` | `site/ship-aerial.jpg` | Bent Van Aeken | https://unsplash.com/photos/an-aerial-view-of-a-cargo-ship-in-the-ocean-0A7YwYhZhWw |
| `public/images/unsplash/nepal-road.jpg` | `site/mountain-road.jpg` | Ashok Acharya | https://unsplash.com/photos/a-truck-navigates-a-narrow-mountain-road-9AFp_3XuUgk |
| `public/images/unsplash/port-aerial.jpg` | `site/port-aerial.jpg` | Haris Illahi | https://unsplash.com/photos/aerial-view-of-a-busy-shipping-port-with-many-containers-JJCrTi0lvTs |
| `public/images/unsplash/warehouse-forklift.jpg` | `site/warehouse-aisle.jpg` | Bernd Dittrich | https://unsplash.com/photos/a-forklift-driving-through-a-warehouse-filled-with-pallets-F2C_mSrb6iM |
| `public/images/unsplash/forklift-loading.jpg` | not used: a carrier's name is on the truck | Bernd Dittrich | https://unsplash.com/photos/forklift-loading-pallets-of-goods-into-a-truck-f0qt5HS40E4 |

## Supplied with the repository

These were already in `public/images/` (the staff app's website-gallery preview uses the originals). Their source is not recorded here; confirm it before reusing them outside this site.

| Original | Graded as |
| --- | --- |
| `public/images/nepal-road-freight.jpg` | `site/road-dawn.jpg` |
| `public/images/himalayan-hero.jpg` | `site/himalaya.jpg` |
| `public/images/air-freight.jpg` | `site/air-dusk.jpg` |
| `public/images/ocean-freight.jpg` | `site/port-dusk.jpg` |
| `public/images/services/road-freight-nepal.jpg` | `site/road-plains.jpg` |
| `public/images/services/specialist-project-cargo.jpg` | `site/project-transformer.jpg` |
| `public/images/services/warehousing.jpg` | `site/warehouse.jpg` |
| `public/images/services/door-to-door.jpg` | `site/door-delivery.jpg` |
| `public/images/services/specialist-break-bulk.jpg` | `site/breakbulk.jpg` |
| `public/images/services/packaging-storage.jpg` | `site/packing.jpg` |
| `public/images/services/specialist-open-top.jpg` | `site/open-top.jpg` |
