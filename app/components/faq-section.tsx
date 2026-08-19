"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Container } from "./container";

const faqs = [
  {
    question: "Does KCPL coordinate both imports and exports?",
    answer: "Yes. KCPL coordinates cargo moving into Nepal, out of Nepal and within Nepal, using air, ocean and road freight as appropriate to the movement.",
  },
  {
    question: "Which freight modes can KCPL coordinate?",
    answer: "KCPL's core forwarding services cover air freight, ocean freight and road freight, with the connected ground, gateway and destination handovers planned around the route.",
  },
  {
    question: "What specialist cargo services are available?",
    answer: "KCPL handles project cargo, break bulk cargo and open top container movements. Cargo dimensions, weight and handling requirements help determine the suitable plan.",
  },
  {
    question: "How does KCPL support customs coordination in Nepal?",
    answer: "KCPL combines its branch network with personnel positioned across Nepal's customs entry points to support documentation, communication and cargo movement through relevant gateways.",
  },
  {
    question: "How does KCPL work internationally?",
    answer: "KCPL operates through its confirmed locations in Nepal and India and works with international logistics counterparts in relevant origin and destination markets. Those counterparts are not represented as KCPL-owned offices.",
  },
] as const;

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return <section className="faq-section bg-offwhite" aria-labelledby="faq-heading">
    <Container>
      <div className="faq-layout">
        <div><p className="eyebrow text-rhododendron">Freight questions</p><h2 id="faq-heading">Useful details before you plan a route.</h2><p>For cargo-specific requirements, share the route and shipment details with the KCPL team.</p></div>
        <div className="faq-list">{faqs.map((faq, index) => { const open = openIndex === index; const panelId = `faq-panel-${index}`; const buttonId = `faq-button-${index}`; return <article key={faq.question} className={open ? "is-open" : ""}><button id={buttonId} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenIndex(open ? null : index)}><span>{faq.question}</span><ChevronDown size={19} aria-hidden="true" /></button><div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open}><p>{faq.answer}</p></div></article>; })}</div>
      </div>
    </Container>
  </section>;
}
