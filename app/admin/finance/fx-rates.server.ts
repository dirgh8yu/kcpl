import { getNrbForexSnapshot } from "../../integrations/nrb-forex.server";
import type { RateTable } from "./money-basis";

/**
 * Nepal Rastra Bank's latest midpoint rates as NPR per unit, or null when NRB
 * can't be reached. Callers fall back to showing each currency on its own and
 * saying which could not be converted; they never guess a rate.
 */
export async function loadNprRateTable(): Promise<RateTable | null> {
  try {
    const snapshot = await getNrbForexSnapshot();
    const rates: Record<string, number> = { NPR: 1 };
    for (const rate of snapshot.rates) {
      if (rate.midpoint_per_unit > 0) rates[rate.currency] = rate.midpoint_per_unit;
    }
    return { rates, date: snapshot.date };
  } catch (error) {
    console.error("NRB rates unavailable; currencies stay unconverted", error);
    return null;
  }
}
