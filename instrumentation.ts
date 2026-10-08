import type { Instrumentation } from "next";

/**
 * Server errors from any page or route reach whoever KCPL_ALERT_EMAIL names,
 * once per route every few hours. The work lives in a Node-only module so
 * nothing Firebase is loaded where it can't run.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { reportRequestError } = await import("./app/ops-monitoring.server");
    await reportRequestError(error, request, context);
  } catch (reportError) {
    console.error("KCPL error report failed", reportError);
  }
};
