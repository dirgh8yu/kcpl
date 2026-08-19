import { ServicePage } from "../../components/service-page";
import { serviceContent } from "../../service-content";
import { createServiceMetadata } from "../../seo";
export const metadata = createServiceMetadata(serviceContent["project-cargo"], "project-cargo");
export default function Page(){return <ServicePage slug="project-cargo" content={serviceContent["project-cargo"]}/>}
