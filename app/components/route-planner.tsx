"use client";

import { useState } from "react";
import Form from "next/form";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { RouteDiagram, type StationId } from "./route-diagram";

type Mode = "sea" | "air" | "road" | "unsure";

export type RoutePlannerLabels = {
  origin: string;
  originHint: string;
  destination: string;
  destinationHint: string;
  mode: string;
  modes: Record<Mode, string>;
  notes: Record<Mode | "out", string>;
  stations: Record<StationId, string>;
  submit: string;
};

const modeOrder: Mode[] = ["sea", "air", "road", "unsure"];

/* Plain matching on what the visitor typed, only to light the matching branch. */
const west = /nepalgunj|surkhet|नेपालगन्ज|नेपालगंज|सुर्खेत|尼泊尔根杰|苏尔凯特/i;
const east = /kathmandu|birgunj|काठमाडौं|काठमाडौँ|काठमांडू|वीरगन्ज|बीरगंज|加德满都|比尔根杰/i;
const surkhet = /surkhet|सुर्खेत|苏尔凯特/i;
const nepal = /nepal|kathmandu|birgunj|नेपाल|काठमाडौं|काठमांडू|尼泊尔|加德满都/i;

/** The same route on a phone, where the drawing becomes a list between the fields. */
function phoneStops(mode: Mode, branch: string | undefined, typed: string): StationId[] {
  if (mode === "air") return ["kathmandu"];
  const inland: StationId[] = branch === "west" ? (surkhet.test(typed) ? ["nepalgunj", "surkhet"] : ["nepalgunj"]) : ["raxaul", "birgunj"];
  return mode === "road" ? inland : ["kolkata", ...inland];
}

/** The quote form as a route: origin at one end, destination at the other, and
 * choosing a freight mode redraws the line between them. */
export function RoutePlanner({ action, labels }: { action: string; labels: RoutePlannerLabels }) {
  const [mode, setMode] = useState<Mode>("sea");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const typed = `${origin} ${destination}`;
  const branch = west.test(typed) ? "west" : east.test(typed) ? "main" : undefined;
  const note = nepal.test(origin) ? labels.notes.out : labels.notes[mode];

  return (
    <Form action={action} className="route-form">
      <div className="route">
        <label className="route-end route-end-origin">
          <span>{labels.origin}</span>
          <input name="origin" value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder={labels.originHint} autoComplete="off" maxLength={120}/>
        </label>
        <RouteDiagram names={labels.stations} mode={mode} branch={branch}/>
        {/* Keyed so that a change of mode draws the line again. */}
        <ol className="route-stops" key={`${mode}-${branch}`} aria-hidden="true">
          {phoneStops(mode, branch, typed).map((id) => <li key={id}>{labels.stations[id]}</li>)}
        </ol>
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
                <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)}/>
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
