import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { affiliations } from "../company-data";
import { listGalleryEntries } from "../site-gallery.server";
import { siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";
import { ClosingBand } from "./closing-band";
import { Lined, PageHead, Stop } from "./route-parts";
import { SiteShell } from "./site-chrome";

/* Only photographs with a recorded source and no other company's branding. */
const galleryImages: { src: string; key: SiteTextKey; width: number; height: number }[] = [
  { src: "/images/unsplash/ship-aerial.jpg", key: "gallery.ocean", width: 2200, height: 1585 },
  { src: "/images/unsplash/nepal-road.jpg", key: "gallery.road", width: 2200, height: 1467 },
  { src: "/images/unsplash/port-aerial.jpg", key: "gallery.gateway", width: 2200, height: 1730 },
  { src: "/images/unsplash/warehouse-forklift.jpg", key: "gallery.handling", width: 1800, height: 1695 },
];

const awardCertificates = [2022, 2023, 2024, 2025] as const;

export async function GalleryPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  let managed: Awaited<ReturnType<typeof listGalleryEntries>> = null;
  try { managed = await listGalleryEntries(true); }
  catch (error) { console.error("Could not load published KCPL gallery", error); }
  const hasPublishedImages = Boolean(managed?.length);
  const images = hasPublishedImages
    ? managed!.map((item) => ({ src: `/api/gallery/${item.id}/image`, title: item.title, alt: item.alt, width: item.width, height: item.height, managed: true }))
    : galleryImages.map((item) => ({ src: item.src, title: t(item.key), alt: t(item.key), width: item.width, height: item.height, managed: false }));
  return (
    <SiteShell locale={locale} path="/gallery">
      <PageHead title={t("gallery.title")} intro={t("gallery.intro")}/>
      <section className="gallery" aria-label={t("chrome.gallery")}>
        {images.map((item, index) => (
          <figure key={item.src}>
            <a href={item.src} target="_blank" rel="noopener noreferrer" aria-label={item.title ? `${item.title}, ${t("chrome.gallery")}` : `${t("chrome.gallery")} ${index + 1}`}>
              <Image src={item.src} alt={item.alt} width={item.width} height={item.height} sizes="(max-width: 900px) 100vw, 50vw" unoptimized={item.managed}/>
            </a>
            {item.title ? <figcaption>{item.title}</figcaption> : null}
          </figure>
        ))}
        {!hasPublishedImages ? <p className="gallery-note">{t("gallery.note")}</p> : null}
      </section>
    </SiteShell>
  );
}

function Certificate({ src, alt, open, caption }: { src: string; alt: string; open: string; caption: React.ReactNode }) {
  return (
    <figure>
      <a href={src} target="_blank" rel="noopener noreferrer" aria-label={open}>
        <Image src={src} alt={alt} width={1871} height={1323} sizes="(max-width: 900px) 100vw, 40vw"/>
      </a>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function AwardsPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const lcci = affiliations.find((item) => item.name === "LCCI")!;
  return (
    <SiteShell locale={locale} path="/awards">
      <PageHead title={t("awards.title")} intro={t("awards.intro")}/>
      <Lined>
        <section className="stop awards-summary">
          <p className="stop-intro">{t("awards.context")}</p>
          <Link href={lcci.href} target="_blank" rel="noopener noreferrer" aria-label={t("awards.issuer")}>
            <Image src={lcci.image} alt={t("awards.issuer")} width={lcci.width} height={lcci.height}/>
            <ArrowUpRight size={18} aria-hidden="true"/>
          </Link>
        </section>
        <Stop title={t("awards.certificates_title")}>
          <div className="certs certs-large">
            {awardCertificates.map((year) => {
              const src = `/images/awards/export-excellence-${year}.jpg`;
              return <Certificate key={year} src={src} alt={`${t("awards.label")} ${year}, ${t("awards.issuer")}`} open={`${t("awards.open")}: ${t("awards.label")} ${year}`} caption={<><b>{year}</b> {t("awards.label")}</>}/>;
            })}
          </div>
        </Stop>
        <Stop title={t("awards.memberships_title")} intro={t("awards.memberships_intro")}>
          <div className="certs certs-large">
            {([
              { src: "/images/awards/cpl-founding-membership.jpg", key: "awards.cpl" },
              { src: "/images/awards/neffa-membership-2025-26.jpg", key: "awards.neffa" },
            ] as const).map((item) => <Certificate key={item.src} src={item.src} alt={t(item.key)} open={`${t("awards.open")}: ${t(item.key)}`} caption={t(item.key)}/>)}
          </div>
        </Stop>
        <ClosingBand locale={locale}/>
      </Lined>
    </SiteShell>
  );
}
