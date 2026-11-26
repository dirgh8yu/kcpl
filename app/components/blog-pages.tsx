import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { blogIndex, blogPhotos, blogPosts, blogTopics, readingMinutes, type BlogBlock, type BlogPhotoKey, type BlogPost, type BlogTopicId } from "../blog-data";
import { guides } from "../guide-data";
import { tools } from "../tool-data";
import { blogPostingNode, graph } from "../structured-data";
import { Breadcrumbs } from "./breadcrumbs";
import { ClosingBand } from "./closing-band";
import { Lined, PageHead, QaList, Stop } from "./route-parts";
import { SiteShell } from "./site-chrome";
import { StructuredData } from "./structured-data";

/* The blog sits on the same line as every other page: a station per section,
 * hairline lists, chamfered photographs. Only its photographs are new, and they
 * are captioned so a reader can tell KCPL's own from an illustration. */

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function PostMeta({ post, byline = false }: { post: BlogPost; byline?: boolean }) {
  return (
    <p className="post-meta">
      {byline ? <span>By {blogIndex.author}</span> : null}
      <time dateTime={post.published}>{date.format(new Date(`${post.published}T00:00:00Z`))}</time>
      <span>{readingMinutes(post)} {blogIndex.minutes}</span>
    </p>
  );
}

function Credit({ photos }: { photos: readonly BlogPhotoKey[] }) {
  return <span>{photos.every((key) => blogPhotos[key].kcpl) ? blogIndex.kcplCredit : blogIndex.illustrative}</span>;
}

function Photo({ photo, sizes, eager = false }: { photo: BlogPhotoKey; sizes: string; eager?: boolean }) {
  const { src, width, height, alt, ...rest } = blogPhotos[photo];
  const position = "position" in rest ? rest.position : undefined;
  return <Image src={src} alt={alt} width={width} height={height} sizes={sizes} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} style={position ? { objectPosition: position } : undefined}/>;
}

function Figure({ photos, caption }: { photos: readonly BlogPhotoKey[]; caption: string }) {
  const tall = photos.length === 1 && blogPhotos[photos[0]].height > blogPhotos[photos[0]].width;
  const className = photos.length > 1 ? "plate post-figure post-pair" : tall ? "plate post-figure is-tall" : "plate post-figure";
  return (
    <figure className={className}>
      <div className="post-figure-media">
        {photos.map((photo) => <Photo key={photo} photo={photo} sizes={photos.length > 1 ? "(max-width: 900px) 100vw, 40vw" : "(max-width: 900px) 100vw, 60vw"}/>)}
      </div>
      <figcaption>{caption} <Credit photos={photos}/></figcaption>
    </figure>
  );
}

/** Paragraphs that follow each other share one column, so their rhythm matches the guides. */
function Blocks({ blocks }: { blocks: readonly BlogBlock[] }) {
  const runs: (BlogBlock | string[])[] = [];
  for (const block of blocks) {
    const last = runs.at(-1);
    if (block.type === "p" && Array.isArray(last)) last.push(block.text);
    else runs.push(block.type === "p" ? [block.text] : block);
  }
  return runs.map((run, index) => {
    if (Array.isArray(run)) return <div key={index} className="content-depth-copy">{run.map((text) => <p key={text}>{text}</p>)}</div>;
    if (run.type === "figure") return <Figure key={index} photos={[run.photo]} caption={run.caption}/>;
    if (run.type === "pair") return <Figure key={index} photos={run.photos} caption={run.caption}/>;
    if (run.type === "steps") return <ol key={index} className="stages">{run.items.map((item) => <li key={item.title}><h3>{item.title}</h3><p>{item.copy}</p></li>)}</ol>;
    if (run.type === "list") return (
      <div key={index} className="post-list">
        {run.title ? <h3 className="block-title">{run.title}</h3> : null}
        <ul className="check-list">{run.items.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    );
    return null;
  });
}

export function BlogIndexPage() {
  const [lead, ...rest] = blogPosts.slice(0, 3);
  return (
    <SiteShell locale="en" path="/blog">
      <PageHead title={blogIndex.title} intro={blogIndex.intro} breadcrumb={<Breadcrumbs locale="en" path="/blog"/>}/>
      <Lined reveal>
        <section className="stop post-lead">
          <h2 className="stop-title"><Link href={`/blog/${lead.slug}`}>{lead.title}</Link></h2>
          <PostMeta post={lead}/>
          <p className="stop-intro">{lead.intro}</p>
          <Link href={`/blog/${lead.slug}`} className="plate post-lead-media" tabIndex={-1} aria-hidden="true">
            <Photo photo={lead.cover} sizes="(max-width: 900px) 100vw, 80vw" eager/>
          </Link>
          <Link href={`/blog/${lead.slug}`} className="text-link">{blogIndex.read}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link>
        </section>
        {rest.length ? (
          <Stop title={blogIndex.more}>
            <ul className="stories">
              {rest.map((post) => (
                <li key={post.slug}>
                  <Link href={`/blog/${post.slug}`} className="story post-card">
                    <span className="plate post-card-media"><Photo photo={post.cover} sizes="(max-width: 900px) 100vw, 40vw"/></span>
                    <h3>{post.title}</h3>
                    <p>{post.intro}</p>
                    <PostMeta post={post}/>
                  </Link>
                </li>
              ))}
            </ul>
          </Stop>
        ) : null}
        <Stop title={blogIndex.topics}>
          <ul className="link-list">
            {blogTopics.map((topic) => <li key={topic.id}><a href={`#${topic.id}`}>{topic.title}<span className="post-count">{inTopic(topic.id).length} {blogIndex.notes}</span></a></li>)}
          </ul>
        </Stop>
        {blogTopics.map((topic) => (
          <Stop key={topic.id} id={topic.id} title={topic.title} intro={topic.intro}>
            <ul className="link-list">
              {inTopic(topic.id).map((post) => <li key={post.slug}><Link href={`/blog/${post.slug}`}>{post.title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>)}
            </ul>
          </Stop>
        ))}
        <ClosingBand locale="en"/>
      </Lined>
    </SiteShell>
  );
}

function inTopic(topic: BlogTopicId) {
  return blogPosts.filter((post) => post.topic === topic);
}

export function BlogPostPage({ post }: { post: BlogPost }) {
  const path = `/blog/${post.slug}`;
  // The next four in the same topic, wrapping round, so every note is linked from its neighbours.
  const topic = inTopic(post.topic);
  const at = topic.indexOf(post);
  const others = [...topic.slice(at + 1), ...topic.slice(0, at)].slice(0, 4);
  return (
    <SiteShell locale="en" path={path}>
      <StructuredData data={graph([blogPostingNode(post.slug)])}/>
      <PageHead title={post.title} intro={post.intro} breadcrumb={<Breadcrumbs locale="en" path={path}/>}>
        <PostMeta post={post} byline/>
        <figure className="post-cover">
          <Photo photo={post.cover} sizes="100vw" eager/>
          <figcaption>{post.coverCaption} <Credit photos={[post.cover]}/></figcaption>
        </figure>
      </PageHead>
      <Lined reveal>
        {post.sections.map((section) => (
          <Stop key={section.title} title={section.title}>
            <Blocks blocks={section.blocks}/>
          </Stop>
        ))}
        {post.questions?.length ? <Stop title={blogIndex.questions}><QaList items={[...post.questions]}/></Stop> : null}
        <section className="stop page-actions">
          <Link href="/quote" className="btn" data-analytics-event="quote_tap">Ask for a quote<ArrowRight size={17} weight="bold" aria-hidden="true"/></Link>
          <Link href={post.related.service.href} className="text-link">{post.related.service.label}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link>
          {post.related.tool ? <Link href={`/tools/${post.related.tool}`} className="text-link">{tools.en[post.related.tool].title}<ArrowRight size={15} weight="bold" aria-hidden="true"/></Link> : null}
        </section>
        <Stop title={blogIndex.related}>
          <ul className="link-list">
            {others.map((entry) => <li key={entry.slug}><Link href={`/blog/${entry.slug}`}>{entry.title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>)}
            {post.related.guides.map((slug) => <li key={slug}><Link href={`/guides/${slug}`}>{guides.en[slug].title}<ArrowRight size={16} weight="bold" aria-hidden="true"/></Link></li>)}
          </ul>
        </Stop>
        <ClosingBand locale="en"/>
      </Lined>
    </SiteShell>
  );
}
