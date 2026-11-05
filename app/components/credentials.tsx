import Image from "next/image";
import { affiliations } from "../company-data";
import { siteTranslator, type SiteLocale } from "../site-i18n";

const awardYears = [2022, 2023, 2024, 2025] as const;

/** The proof a tender reader checks: the certificates as issued, the memberships
 * and the facts KCPL can back with a document. */
export function Credentials({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const facts = [
    { label: t("company.established_short"), detail: t("company.established_where") },
    { label: t("home.credibility_award"), detail: t("home.credibility_award_detail") },
    { label: t("home.credibility_storage"), detail: t("home.credibility_storage_detail") },
    { label: t("home.credibility_member"), detail: t("home.credibility_member_detail") },
    { label: t("home.credibility_projects"), detail: t("home.credibility_projects_detail") },
    { label: t("home.credibility_staff"), detail: t("network.staffed_places") },
  ];
  return (
    <>
      <div className="credentials">
        <ul className="marks">
          {affiliations.filter((mark) => mark.name !== "JCtrans").map((mark) => (
            <li key={mark.name}><Image src={mark.image} alt={mark.detail} width={mark.width} height={mark.height}/></li>
          ))}
        </ul>
        <div className="certs">
          {awardYears.map((year) => (
            <figure key={year}>
              <Image src={`/images/awards/export-excellence-${year}.jpg`} alt={`${t("awards.label")} ${year}, ${t("awards.issuer")}`} width={1871} height={1323} sizes="(max-width: 900px) 45vw, 22vw"/>
              <figcaption>{year}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <dl className="facts">
        {facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.detail}</dd></div>)}
      </dl>
    </>
  );
}
