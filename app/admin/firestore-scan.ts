/*
 * Complete reads of a Firestore query, a page at a time.
 *
 * Firestore returns a query with no orderBy in document-id order, and KCPL's
 * references begin with the date they were created (KCPL-S-20260929-…,
 * KCPL-I-20260929-…). So a bare `.limit(2000)` does not keep "some" records:
 * it keeps the 2,000 OLDEST and silently drops everything newer. Screens and
 * sweeps that must see every record page through with `readAllDocuments`
 * instead, and learn whether they reached the end.
 *
 * Pure: the query is anything with limit/startAfter/get, so the paging is
 * tested without Firebase. Paging by the last document needs no index beyond
 * what the query itself already uses.
 */

export type ScannableQuery<Doc> = {
  limit(limit: number): ScannableQuery<Doc>;
  startAfter(cursor: Doc): ScannableQuery<Doc>;
  get(): Promise<{ docs: Doc[] }>;
};

export type ScanResult<Doc> = {
  docs: Doc[];
  /** False only when the ceiling stopped the read before the query ran out. */
  complete: boolean;
};

export const SCAN_PAGE_SIZE = 500;
/** A backstop against a runaway read, far above KCPL's volumes, never a working limit. */
export const SCAN_CEILING = 100_000;

export async function readAllDocuments<Doc>(
  query: ScannableQuery<Doc>,
  options: { pageSize?: number; ceiling?: number } = {},
): Promise<ScanResult<Doc>> {
  const pageSize = Math.max(1, options.pageSize ?? SCAN_PAGE_SIZE);
  const ceiling = Math.max(1, options.ceiling ?? SCAN_CEILING);
  const docs: Doc[] = [];
  let cursor: Doc | null = null;
  for (;;) {
    const room = ceiling - docs.length;
    // One extra past the ceiling tells a full stop apart from a query that ended exactly there.
    const take = Math.min(pageSize, room + 1);
    let page = query.limit(take);
    if (cursor !== null) page = page.startAfter(cursor);
    const snapshot = await page.get();
    if (snapshot.docs.length > room) {
      docs.push(...snapshot.docs.slice(0, room));
      return { docs, complete: false };
    }
    docs.push(...snapshot.docs);
    if (snapshot.docs.length < take) return { docs, complete: true };
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
}

/** Runs [task] over [items] with at most [concurrency] in flight, keeping order. */
export async function mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
