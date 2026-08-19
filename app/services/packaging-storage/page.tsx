import { ServicePage } from "../../components/service-page";
import { serviceContent } from "../../service-content";
import { createServiceMetadata } from "../../seo";
export const metadata = createServiceMetadata(serviceContent["packaging-storage"], "packaging-storage");
export default function Page(){return <ServicePage slug="packaging-storage" content={serviceContent["packaging-storage"]}/>}
