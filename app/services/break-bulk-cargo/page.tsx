import { ServicePage } from "../../components/service-page";
import { serviceContent } from "../../service-content";
import { createServiceMetadata } from "../../seo";
export const metadata = createServiceMetadata(serviceContent["break-bulk-cargo"], "break-bulk-cargo");
export default function Page(){return <ServicePage slug="break-bulk-cargo" content={serviceContent["break-bulk-cargo"]}/>}
