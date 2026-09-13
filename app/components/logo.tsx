import Image from "next/image";
import Link from "next/link";

export function Logo({ inverse = false, variant = "default" }: { inverse?: boolean; variant?: "default" | "header" }) {
  const isHeader = variant === "header";

  return (
    <Link
      href="/"
      aria-label="Kapileshwor Cargo home"
      className={`brand-lockup ${isHeader ? "brand-lockup-header" : ""}`}
    >
      <span className="brand-mark" aria-hidden="true">
        <Image
          src="/images/brand/kcpl-gateway-k.svg"
          alt=""
          fill
          sizes={isHeader ? "46px" : "44px"}
          className="object-contain"
        />
      </span>
      <span className={`brand-wordmark ${inverse ? "is-inverse" : ""}`}>
        <span className="brand-wordmark-name">Kapileshwor</span>
        <span className="brand-wordmark-meta">Cargo Pvt. Ltd.</span>
      </span>
    </Link>
  );
}
