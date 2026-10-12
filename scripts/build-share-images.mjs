// The link preview WhatsApp, Facebook and LinkedIn show for a shared page: one
// 1200x630 card per language, set like the site itself — the lockup, the home
// page's headline in that language, and one rounded photograph.
//
//   npm run build                      (the card borrows the site's own fonts)
//   npm i --no-save playwright         (once; it is not a project dependency)
//   node scripts/build-share-images.mjs
//
// Writes public/og/<locale>.jpg. app/seo.ts points each language's pages at its
// own card. Chinese is set in the machine's CJK sans (Noto Sans CJK SC or
// WenQuanYi Zen Hei), so check the zh card after running it elsewhere.
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import sharp from "sharp";
import { siteLocales, siteTranslator } from "../app/site-i18n.ts";

const root = new URL("../", import.meta.url);
const file = (path) => new URL(path, root);

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is needed to draw the cards: npm i --no-save playwright");
  process.exit(1);
}

/* next/font serves Inter and Manrope from the build; the Latin face of each is
 * the one whose unicode-range starts with U+0000-00FF, which the minifier
 * writes as U+?? or U+0-FF. */
function builtFont(family) {
  const chunks = new URL(".next/static/chunks/", root);
  let css = "";
  try {
    css = readdirSync(chunks).filter((name) => name.endsWith(".css")).map((name) => readFileSync(new URL(name, chunks), "utf8")).join("\n");
  } catch {
    // Reported below.
  }
  const face = [...css.matchAll(/@font-face\{([^}]*)\}/g)].map((match) => match[1])
    .find((body) => new RegExp(`font-family:['"]?${family}['"]?;`).test(body) && /unicode-range:U\+(\?\?|0+-)/.test(body));
  const src = face?.match(/url\(\.\.\/media\/([^)]+)\)/)?.[1];
  if (!src) {
    console.error(`No built ${family} font found: run npm run build first.`);
    process.exit(1);
  }
  return fontData(`.next/static/media/${src}`);
}

/* The card is set from a string, which cannot load file:// URLs, so every font
 * goes in as a data URI. */
function fontData(path) {
  return `data:font/woff2;base64,${readFileSync(file(path)).toString("base64")}`;
}

const inter = builtFont("Inter");
const manrope = builtFont("Manrope");
const devanagari = fontData("public/fonts/noto-sans-devanagari.woff2");
const mark = readFileSync(file("public/images/brand/kcpl-gateway-k.svg"), "utf8");
const photo = `data:image/jpeg;base64,${readFileSync(file("public/images/site/road-dawn.jpg")).toString("base64")}`;

const headlineFont = {
  en: `"Inter", sans-serif`,
  ne: `"Noto Sans Devanagari Site", "Inter", sans-serif`,
  hi: `"Noto Sans Devanagari Site", "Inter", sans-serif`,
  zh: `"Noto Sans CJK SC", "WenQuanYi Zen Hei", "Inter", sans-serif`,
};

/* Two sentences, or two clauses in Chinese, read best one to a line; English
 * wraps on its own. */
function headline(locale) {
  const text = siteTranslator(locale)("home.hero_title");
  return locale === "en" ? text : text.replace(/([।，]) ?/g, "$1<br>");
}

function card(locale) {
  const latin = locale === "en";
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>
    @font-face { font-family: "Inter"; src: url("${inter}") format("woff2"); font-weight: 100 900; }
    @font-face { font-family: "Manrope"; src: url("${manrope}") format("woff2"); font-weight: 200 800; }
    @font-face { font-family: "Noto Sans Devanagari Site"; src: url("${devanagari}") format("woff2"); font-weight: 100 900; }
    * { box-sizing: border-box; margin: 0; }
    body { width: 1200px; height: 630px; display: grid; grid-template-columns: 1fr 470px; gap: 40px; padding: 44px; background: #fff; color: #1d1d1f; }
    .text { display: flex; flex-direction: column; justify-content: space-between; padding: 20px 0 20px 20px; }
    .lockup { display: flex; align-items: center; gap: 12px; }
    .lockup svg { width: 46px; height: 46px; }
    .name { font: 800 21px/1.05 "Manrope", sans-serif; letter-spacing: .01em; text-transform: uppercase; }
    .meta { font: 500 13px/1.3 "Manrope", sans-serif; color: #6e6e73; }
    h1 { font-family: ${headlineFont[locale]}; font-weight: 700; font-size: ${latin ? 76 : 50}px; line-height: ${latin ? 1.02 : 1.3}; letter-spacing: ${latin ? "-0.045em" : "0"}; text-wrap: balance; }
    /* The CJK face here may have no bold; a hairline stroke stands in for it. */
    h1:lang(zh) { -webkit-text-stroke: ${locale === "zh" ? "1.4px" : "0"} currentColor; }
    figure { margin: 0; border-radius: 28px; overflow: hidden; }
    figure img { width: 100%; height: 100%; object-fit: cover; object-position: 60% 50%; display: block; }
  </style></head><body>
    <div class="text">
      <div class="lockup">${mark}<div><div class="name">Kapileshwor</div><div class="meta">Cargo Pvt. Ltd.</div></div></div>
      <h1>${headline(locale)}</h1>
    </div>
    <figure><img src="${photo}" alt=""></figure>
  </body></html>`;
}

mkdirSync(file("public/og/"), { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const locale of siteLocales) {
  await page.setContent(card(locale), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png" });
  const out = file(`public/og/${locale}.jpg`);
  const info = await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(out.pathname);
  console.log(`public/og/${locale}.jpg ${Math.round(info.size / 1024)}KB`);
}
await browser.close();
