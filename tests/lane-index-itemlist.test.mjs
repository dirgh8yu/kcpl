import assert from "node:assert/strict";
import test from "node:test";
import { laneIndexItemListNode } from "../app/lane-index-schema.ts";
import { laneFor, laneSlugs } from "../app/lane-data.ts";

/* The lane index is the one page that links every corridor. Its ItemList has to
 * name exactly those links, on the locale's own paths, or a crawler learns a
 * different set from the one a reader can click. */

const locales = ["en", "ne", "hi", "zh"];

function lanePath(locale, slug) {
  return locale === "en" ? `/lanes/${slug}` : `/${locale}/lanes/${slug}`;
}

test("the lane index emits an ItemList naming every lane the page links to", () => {
  for (const locale of locales) {
    const node = laneIndexItemListNode(locale);
    assert.equal(node["@type"], "ItemList");
    assert.equal(node.numberOfItems, laneSlugs.length);
    assert.equal(node.itemListElement.length, laneSlugs.length);
    assert.ok(node.name.length > 0);
    assert.ok(node["@id"].endsWith(`${locale === "en" ? "" : `/${locale}`}/lanes#lanes`));

    const urls = node.itemListElement.map((item) => item.url);
    assert.equal(new Set(urls).size, laneSlugs.length, `${locale}: one entry per lane`);

    node.itemListElement.forEach((item, index) => {
      const slug = laneSlugs[index];
      assert.equal(item["@type"], "ListItem");
      assert.equal(item.position, index + 1);
      assert.equal(item.name, laneFor(locale, slug).title);
      assert.ok(item.url.endsWith(lanePath(locale, slug)), `${locale}: ${item.url}`);
    });
  }
});

test("every ItemList entry is a link the index page itself repeats", () => {
  for (const locale of locales) {
    const node = laneIndexItemListNode(locale);
    const linked = node.itemListElement.map((item) => item.url.replace(/^https?:\/\/[^/]+/, ""));
    assert.deepEqual(linked, laneSlugs.map((slug) => lanePath(locale, slug)));
  }
});
