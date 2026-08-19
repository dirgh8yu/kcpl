import { ServicePage } from "../../components/service-page";
import { serviceContent } from "../../service-content";
import { createServiceMetadata } from "../../seo";
export const metadata = createServiceMetadata(serviceContent["road-freight"], "road-freight");
export default function Page(){return <ServicePage slug="road-freight" content={serviceContent["road-freight"]}/>}
