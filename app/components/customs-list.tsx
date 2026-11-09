"use client";

import { useState } from "react";

/** Every customs point, one quiet column per border. Pointing at a name lights its arm
 * of the hero drawing (site.css does that with :has). Phones show a few until asked. */
export function CustomsList({ names, labels }: { names: Record<"china" | "india", string[]>; labels: { china: string; india: string; more: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? "customs" : "customs is-folded"}>
      <div className="customs-china">
        <h3>{labels.china}</h3>
        <ul>{names.china.map((name) => <li key={name}>{name}</li>)}</ul>
      </div>
      <div className="customs-india">
        <h3>{labels.india}</h3>
        <ul>{names.india.map((name) => <li key={name}>{name}</li>)}</ul>
      </div>
      {open ? null : <button type="button" className="text-link customs-more" onClick={() => setOpen(true)}>{labels.more}</button>}
    </div>
  );
}
