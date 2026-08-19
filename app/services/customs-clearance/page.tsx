import { ServicePage } from "../../components/service-page";
import { serviceContent } from "../../service-content";
import { createServiceMetadata } from "../../seo";
export const metadata = createServiceMetadata(serviceContent["customs-clearance"], "customs-clearance");
export default function Page(){return <ServicePage slug="customs-clearance" content={serviceContent["customs-clearance"]}/>}
