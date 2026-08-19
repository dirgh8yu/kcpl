import { ServicePage } from "../../components/service-page";
import { serviceContent } from "../../service-content";
import { createServiceMetadata } from "../../seo";
export const metadata = createServiceMetadata(serviceContent["open-top-container"], "open-top-container");
export default function Page(){return <ServicePage slug="open-top-container" content={serviceContent["open-top-container"]}/>}
