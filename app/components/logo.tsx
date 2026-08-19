import Image from "next/image";
import Link from "next/link";

export function Logo({ inverse = false, variant = "default" }: { inverse?: boolean; variant?: "default" | "header" }) {
  const isHeader = variant === "header";

  return (
    <Link href="/" aria-label="Kapileshwor Cargo home" className={`brand-lockup ${isHeader ? "brand-lockup-header" : ""}`}>
      <span className="brand-mark">
        <Image src="/images/brand/kcpl-logo-mark.png" alt="" fill sizes={isHeader ? "48px" : "44px"} className="object-cover" />
      </span>
      <span className={`brand-copy ${inverse ? "is-inverse" : ""}`}>
        {isHeader ? (
          <>
            <span className="brand-name">Kapileshwor</span>
            <span className="brand-meta"><b>Cargo</b> · Pvt. Ltd.</span>
          </>
        ) : (
          <>
            <span className="brand-name-default">Kapileshwor Cargo</span>
            <span className="brand-meta-default">Pvt. Ltd. · Nepal</span>
          </>
        )}
      </span>
    </Link>
  );
}
