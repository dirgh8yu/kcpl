import { ServicePage } from "../../components/service-page";
import { serviceContent } from "../../service-content";
import { createServiceMetadata } from "../../seo";
export const metadata = createServiceMetadata(serviceContent["door-to-door"], "door-to-door");
export default function Page(){return <ServicePage slug="door-to-door" content={serviceContent["door-to-door"]}/>}
