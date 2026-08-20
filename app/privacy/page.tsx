import Link from "next/link";
import { Container } from "../components/container";
import { PageShell } from "../components/page-shell";
import { company } from "../company-data";
import { createPageMetadata } from "../seo";

export const metadata = createPageMetadata({ title: "Privacy Policy", description: "How the Kapileshwor Cargo website handles enquiry details, optional analytics preferences and external links.", path: "/privacy" });

export default function PrivacyPage() {
  return <PageShell eyebrow="Privacy" title="A clear approach to website information." intro="This policy explains what the KCPL website processes when you browse the site or submit a freight enquiry.">
    <section className="privacy-section bg-offwhite"><Container><div className="privacy-layout"><aside><p className="eyebrow text-rhododendron">Last updated</p><strong>20 August 2026</strong><Link href={`mailto:${company.email}`}>Questions about privacy</Link></aside><article>
      <section><h2>Information you choose to provide</h2><p>When you submit the quote form, KCPL receives and stores the route, cargo and contact details you enter so the team can review the request, contact you and coordinate follow-up. Each submitted enquiry is assigned a KCPL reference number. Please do not include sensitive information that is not needed to discuss the shipment.</p></section>
      <section><h2>How enquiry information is used</h2><p>Quote information is used for freight planning, responding to your request and related operational follow-up. Access to stored enquiries and private operational notes is restricted to authorised KCPL staff through the internal operations dashboard. KCPL does not send the contents of quote forms to Google Analytics. If the online submission service is unavailable, you can choose to send the same information directly by email instead.</p></section>
      <section><h2>Internal staff sign-in</h2><p>The KCPL operations dashboard is protected by a private administrator login. After a successful sign-in, the website stores a short-lived secure session cookie so the authorised staff member can use the dashboard. The session cookie is not used for advertising or public-site analytics. Internal notes may record the administrator name and email configured by KCPL for operational accountability.</p></section>
      <section><h2>Contacting KCPL</h2><p>If you email or call KCPL, the information you provide is handled through the company&apos;s normal communication systems so the team can review and respond to your enquiry.</p></section>
      <section><h2>Optional website analytics</h2><p>Google Analytics is prepared but loads only in production when KCPL supplies a valid measurement ID and a visitor chooses to allow analytics. The implementation records page views and broad CTA events on the public website, not form contents or internal operations dashboard activity. Your preference is stored in your browser.</p></section>
      <section><h2>Cookies and local storage</h2><p>The public website does not require marketing cookies. If analytics is configured, a consent preference is stored locally and Google Analytics may set its own measurement cookies only after permission is granted. The private operations dashboard uses a secure session cookie only after an authorised administrator signs in.</p></section>
      <section><h2>External services</h2><p>The website links to email, telephone, mapping and affiliation websites. Those services operate under their own privacy terms once you leave this site.</p></section>
      <section><h2>Your choices</h2><p>You can decline optional analytics when the preference notice appears. You may also clear site data in your browser. For questions about an enquiry or information you have submitted to KCPL, contact <a href={`mailto:${company.email}`}>{company.email}</a> and include your KCPL reference number where available.</p></section>
    </article></div></Container></section>
  </PageShell>;
}
