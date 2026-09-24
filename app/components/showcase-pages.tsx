import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { affiliations } from "../company-data";
import { listGalleryEntries } from "../site-gallery.server";
import { siteTranslator, type SiteLocale, type SiteTextKey } from "../site-i18n";
import { SiteShell } from "./site-chrome";

const galleryImages: { src: string; key: SiteTextKey; width: number; height: number }[] = [
  { src: "/images/unsplash/ship-aerial.jpg", key: "gallery.ocean", width: 2200, height: 1585 },
  { src: "/images/unsplash/air-cargo.jpg", key: "gallery.air", width: 1800, height: 1200 },
  { src: "/images/unsplash/nepal-road.jpg", key: "gallery.road", width: 2200, height: 1467 },
  { src: "/images/unsplash/port-aerial.jpg", key: "gallery.gateway", width: 2200, height: 1730 },
  { src: "/images/services/packaging-storage.jpg", key: "gallery.handling", width: 1536, height: 1024 },
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
      <section className="section showcase-head">
        <h1 className="section-title">{t("gallery.title")}</h1>
        <p className="section-intro">{t("gallery.intro")}</p>
      </section>
      <section className="section gallery-section" aria-label={t("chrome.gallery")}>
        <div className="gallery-grid">
          {images.map((item, index) => (
            <figure className="gallery-item" key={item.src}>
              <a href={item.src} target="_blank" rel="noopener noreferrer" aria-label={item.title ? `${item.title} — ${t("chrome.gallery")}` : `${t("chrome.gallery")} ${index + 1}`}>
                <Image src={item.src} alt={item.alt} width={item.width} height={item.height} sizes="(max-width: 700px) 100vw, 60vw" className="gallery-photo" unoptimized={item.managed} />
                <span className="gallery-view" aria-hidden="true"><ArrowUpRight size={20} /></span>
              </a>
              {item.title ? <figcaption>{item.title}</figcaption> : null}
            </figure>
          ))}
        </div>
        {!hasPublishedImages ? <p className="gallery-disclosure">{t("gallery.note")}</p> : null}
      </section>
    </SiteShell>
  );
}

export function AwardsPage({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const lcci = affiliations.find((item) => item.name === "LCCI")!;
  return (
    <SiteShell locale={locale} path="/awards">
      <section className="section showcase-head awards-head">
        <h1 className="section-title">{t("awards.title")}</h1>
        <p className="section-intro">{t("awards.intro")}</p>
      </section>
      <section className="section awards-section" aria-label={t("awards.label")}>
        <div className="awards-summary">
          <p>{t("awards.context")}</p>
          <Link href={lcci.href} target="_blank" rel="noopener noreferrer" aria-label={t("awards.issuer")}>
            <Image src={lcci.image} alt={t("awards.issuer")} width={lcci.width} height={lcci.height} />
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <div className="certificate-group">
          <h2>{t("awards.certificates_title")}</h2>
          <div className="certificate-grid">
            {awardCertificates.map((year) => {
              const src = `/images/awards/export-excellence-${year}.jpg`;
              return (
                <figure className="certificate-item" key={year}>
                  <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`${t("awards.open")}: ${t("awards.label")} ${year}`}>
                    <Image src={src} alt={`${t("awards.label")} ${year} — ${t("awards.issuer")}`} width={1871} height={1323} sizes="(max-width: 700px) 100vw, 45vw" />
                    <span className="certificate-open" aria-hidden="true"><ArrowUpRight size={18} /></span>
                  </a>
                  <figcaption><span>{year}</span>{t("awards.label")}</figcaption>
                </figure>
              );
            })}
          </div>
        </div>
        <div className="certificate-group membership-group">
          <h2>{t("awards.memberships_title")}</h2>
          <p>{t("awards.memberships_intro")}</p>
          <div className="certificate-grid">
            {([
              { src: "/images/awards/cpl-founding-membership.jpg", key: "awards.cpl" },
              { src: "/images/awards/neffa-membership-2025-26.jpg", key: "awards.neffa" },
            ] as const).map((item) => (
              <figure className="certificate-item" key={item.src}>
                <a href={item.src} target="_blank" rel="noopener noreferrer" aria-label={`${t("awards.open")}: ${t(item.key)}`}>
                  <Image src={item.src} alt={t(item.key)} width={1871} height={1323} sizes="(max-width: 700px) 100vw, 45vw" />
                  <span className="certificate-open" aria-hidden="true"><ArrowUpRight size={18} /></span>
                </a>
                <figcaption>{t(item.key)}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
