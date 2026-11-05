// Tell IndexNow search engines (Bing, Yandex, Naver, Seznam, Yep, Amazon) about
// the pages in the live sitemap. Google does not take part; it reads the sitemap
// through Search Console. Run after a deploy that adds or changes pages:
//
//   npm run indexnow
//
// The key is public by design: it only proves this site asked for the crawl.
const site = "https://kapileshworcargo.com.np";
const key = "eaf4256d6e6d8e751afe7108f69f2f0a";
const keyLocation = `${site}/${key}.txt`;

const liveKey = await (await fetch(keyLocation)).text();
if (liveKey.trim() !== key) throw new Error(`${keyLocation} is not live yet`);

const sitemap = await (await fetch(`${site}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (!urlList.length) throw new Error("The sitemap has no pages");

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(site).host, key, keyLocation, urlList }),
});
console.log(`IndexNow answered ${response.status} for ${urlList.length} pages`);
if (!response.ok) process.exit(1);
