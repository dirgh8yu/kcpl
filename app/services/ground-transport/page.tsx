import { ServicePage } from "../../components/service-page";
import { serviceContent } from "../../service-content";
import { createServiceMetadata } from "../../seo";
export const metadata = createServiceMetadata(serviceContent["ground-transport"], "ground-transport");
export default function Page(){return <ServicePage slug="ground-transport" content={serviceContent["ground-transport"]}/>}
