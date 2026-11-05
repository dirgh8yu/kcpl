import Link from "next/link";
import { ArrowRight, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { depthMovementCopy, depthReferenceCopy, type DepthContent } from "../content-depth";
import { Stop } from "./route-parts";

export function ContentDepth({ content }: { content: DepthContent }) {
  return (
    <>
      {content.sections.map((section) => (
        <Stop key={section.title} title={section.title} className="content-depth">
          <div className="content-depth-copy">
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          {section.points ? <ul className="check-list">{section.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}
        </Stop>
      ))}
      {content.movement ? (
        <Stop title={depthMovementCopy.title}>
          <Link href={content.movement.href} className="text-link">{content.movement.label}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link>
        </Stop>
      ) : null}
      {content.sources.length ? (
        <Stop title={depthReferenceCopy.title} className="content-sources">
          <p className="stop-intro">{depthReferenceCopy.intro}</p>
          <ul className="link-list">
            {content.sources.map((source) => (
              <li key={source.href}>
                <a href={source.href} target="_blank" rel="noreferrer">{source.label}<ArrowSquareOut size={16} weight="bold" aria-hidden="true"/></a>
              </li>
            ))}
          </ul>
        </Stop>
      ) : null}
    </>
  );
}
