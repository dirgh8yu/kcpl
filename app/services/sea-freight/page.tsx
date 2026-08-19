import { ServicePage } from "../../components/service-page";
import { serviceContent } from "../../service-content";
import { createServiceMetadata } from "../../seo";
export const metadata = createServiceMetadata(serviceContent["sea-freight"], "sea-freight");
export default function Page(){return <ServicePage slug="sea-freight" content={serviceContent["sea-freight"]}/>}
