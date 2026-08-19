import { ServicePage } from "../../components/service-page";
import { serviceContent } from "../../service-content";
import { createServiceMetadata } from "../../seo";
export const metadata = createServiceMetadata(serviceContent.warehousing, "warehousing");
export default function Page(){return <ServicePage slug="warehousing" content={serviceContent.warehousing}/>}
