import Link from "next/link";
import { breadcrumbItems } from "../structured-data";
import { sitePath, type SiteLocale } from "../site-i18n";

/** The visible trail and BreadcrumbList share one source, so labels, order and
 * locale-prefixed URLs cannot drift between the page and its structured data. */
export function Breadcrumbs({ locale, path }: { locale: SiteLocale; path: string }) {
  const items = breadcrumbItems(locale, path);
  if (!items) return null;

  return (
    <nav className="breadcrumbs" aria-label={items.map((item) => item.name).join(" / ")}>
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={item.path}>
              {index > 0 ? <span className="breadcrumb-separator" aria-hidden="true">/</span> : null}
              {current
                ? <span aria-current="page">{item.name}</span>
                : <Link href={sitePath(locale, item.path)}>{item.name}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
