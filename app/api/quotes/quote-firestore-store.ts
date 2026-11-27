/*
 * The Firestore adapter the public quote endpoint writes through.
 *
 * It is a separate module for one reason: the two decisions that decide whether a
 * submitted enquiry survives are made here, and they can be asserted without a
 * Firebase project. The enquiry goes to the `quotes` collection under its own
 * reference, and it goes there with `create()` rather than `set()`. `create()`
 * fails when the document already exists, so a reference collision is a visible
 * error instead of a silent overwrite of the enquiry stored under that
 * reference. `set()` would have made the second submission destroy the first.
 *
 * The parameter is shaped rather than typed as `Firestore`, so a recording double
 * stands in for the SDK in tests while production passes the real `Firestore`
 * instance (`firebaseAdminDb()`), whose `collection().doc().create()` matches it.
 */

export type QuoteFirestore = {
  collection(name: string): {
    doc(id: string): {
      create(record: Record<string, unknown>): Promise<unknown>;
    };
  };
};

/** `quotes/{reference}`, written once. A second write to a reference is an error. */
export function firestoreQuoteStore(db: QuoteFirestore) {
  return {
    async create(reference: string, record: Record<string, unknown>) {
      await db.collection("quotes").doc(reference).create(record);
    },
  };
}
