import { ServicePage } from "../../components/service-page";
import { serviceContent } from "../../service-content";
import { createServiceMetadata } from "../../seo";
export const metadata = createServiceMetadata(serviceContent["air-freight"], "air-freight");
export default function Page(){return <ServicePage slug="air-freight" content={serviceContent["air-freight"]}/>}
