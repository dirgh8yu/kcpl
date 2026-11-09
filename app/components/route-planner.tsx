"use client";

import { useState } from "react";
import Form from "next/form";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { K_PICKS, KRoute, type KFocus, type KLabels, type KPart, type KStation } from "./k-route";

type Mode = "sea" | "air" | "road" | "unsure";

export type RoutePlannerLabels = {
  origin: string;
  originHint: string;
  destination: string;
  destinationHint: string;
  mode: string;
  modes: Record<Mode, string>;
  notes: Record<Mode | "out", string>;
  route: KLabels;
  submit: string;
};

const modeOrder: Mode[] = ["sea", "air", "road", "unsure"];

/* Plain matching on what the visitor typed, only to light the matching arm. */
const china = /china|kerung|gyirong|rasuwa|tatopani|zhangmu|shigatse|lhasa|tibet|चीन|केरुङ|केरुंग|रसुवा|तातोपानी|中国|吉隆|樟木|日喀则|拉萨|西藏/i;
const india = /india|kolkata|calcutta|haldia|visakhapatnam|raxaul|birgunj|nepalgunj|surkhet|delhi|mumbai|भारत|कोलकाता|रक्सौल|वीरगन्ज|बीरगंज|नेपालगन्ज|नेपालगंज|सुर्खेत|印度|加尔各答|比尔根杰|尼泊尔根杰/i;
const nepal = /nepal|kathmandu|birgunj|नेपाल|काठमाडौं|काठमांडू|尼泊尔|加德满都/i;

/* A mode change redraws only the routes it is about. */
const REDRAW: Record<Mode, KPart[]> = { sea: ["india", "diagonal"], air: ["air"], road: ["china", "india", "diagonal", "tatopani"], unsure: ["china", "india", "diagonal", "tatopani"] };
const MODE_FOCUS: Record<Mode, KFocus> = { sea: "india", air: "air", road: null, unsure: null };

/** The quote form as a route: origin at one end, destination at the other, and the
 * K drawing between them lights the route the visitor's choices point to. */
export function RoutePlanner({ action, labels }: { action: string; labels: RoutePlannerLabels }) {
  const [mode, setMode] = useState<Mode>("sea");
  const [touched, setTouched] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [redrawn, setRedrawn] = useState<Record<KPart, number>>({ china: 0, india: 0, diagonal: 0, tatopani: 0, air: 0 });
  const typed = `${origin} ${destination}`;
  // What the visitor typed wins; otherwise the mode, once they have chosen one.
  const focus: KFocus = china.test(typed) ? "china" : india.test(typed) ? "india" : touched ? MODE_FOCUS[mode] : null;
  const note = nepal.test(origin) ? labels.notes.out : labels.notes[mode];

  function choose(value: Mode) {
    setMode(value);
    setTouched(true);
    setRedrawn((count) => ({ ...count, ...Object.fromEntries(REDRAW[value].map((part) => [part, count[part] + 1])) }));
  }

  function pick(station: KStation) {
    const { box, part } = K_PICKS[station];
    const name = labels.route.stations[station].split(" · ")[part] ?? labels.route.stations[station];
    if (box === "origin") setOrigin(name); else setDestination(name);
  }

  return (
    <Form action={action} className="route-form">
      <div className="route">
        <label className="route-end route-end-origin">
          <span>{labels.origin}</span>
          <input name="origin" value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder={labels.originHint} autoComplete="off" maxLength={120}/>
        </label>
        <KRoute labels={labels.route} focus={focus} redrawn={redrawn} onPick={pick}/>
        <label className="route-end">
          <span>{labels.destination}</span>
          <input name="destination" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={labels.destinationHint} autoComplete="off" maxLength={120}/>
        </label>
      </div>
      <div className="route-controls">
        <fieldset className="mode-field">
          <legend>{labels.mode}</legend>
          <div>
            {modeOrder.map((value) => (
              <label key={value}>
                <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => choose(value)}/>
                <span>{labels.modes[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="route-note" aria-live="polite">{note}</p>
        <button type="submit" className="btn" data-analytics-event="quote_tap">{labels.submit}<ArrowRight size={17} weight="bold" aria-hidden="true"/></button>
      </div>
    </Form>
  );
}
