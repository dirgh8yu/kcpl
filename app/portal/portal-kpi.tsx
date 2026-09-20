/*
 * The customer portal's KPI strip is the staff one: same component, same card,
 * so a number the customer sees is presented exactly as the number KCPL staff
 * see on the operations side. The portal-flavoured names are kept because
 * every portal call site reads better with them.
 */
export {
  AppKpiStrip as PortalKpiStrip,
  type AppKpi as PortalKpi,
  type AppKpiItem as PortalKpiItem,
  type AppKpiTone as PortalKpiTone,
} from "../admin/kpi-strip";
