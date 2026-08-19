import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { serviceGroups } from "../company-data";
import { Container } from "../components/container";
import { PageShell } from "../components/page-shell";
const groups = [
  { n:"01", title:"Freight forwarding", intro:"Core transport modes for cargo moving within Nepal, across borders and internationally.", items:serviceGroups.freight },
  { n:"02", title:"Specialist cargo", intro:"Planning for loads that require non-standard handling, access or transport coordination.", items:serviceGroups.specialist },
  { n:"03", title:"Logistics & handling", intro:"The services that prepare, connect and complete the cargo journey.", items:serviceGroups.logistics },
];
export default function ServicesPage(){return <PageShell eyebrow="Our services" title="One logistics partner. Multiple ways forward." intro="Freight forwarding, specialist cargo and supporting logistics coordinated around the route."><section className="section bg-white"><Container><div className="service-catalogue">{groups.map((group)=><section key={group.title} className="catalogue-group"><div><span>{group.n}</span><h2>{group.title}</h2><p>{group.intro}</p></div><div>{group.items.map((item)=><Link key={item.title} href={item.href}><span>{item.title}</span><ArrowRight size={18}/></Link>)}</div></section>)}</div></Container></section></PageShell>}
