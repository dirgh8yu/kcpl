import assert from "node:assert/strict";
import test from "node:test";
import { laneLinksForPost } from "../app/blog-lane-links.ts";
import { blogPosts } from "../app/blog-data.ts";
import { laneSlugs } from "../app/lane-data.ts";

/* Blog notes link the corridor they discuss, and only that. A note filed under
 * air freight has no corridor page to point at, and pointing it at a sea lane
 * would misdescribe it. */

test("a Birgunj note links the Kolkata corridor", () => {
  const post = blogPosts.find((entry) => entry.slug === "container-at-birgunj-what-happens-next");
  assert.ok(post);
  assert.ok(laneLinksForPost(post).includes("kolkata-to-birgunj"));
});

test("a note that names Tibet or Kerung links the northern lane", () => {
  const named = blogPosts.filter((entry) => /tibet|kerung|rasuwagadhi/i.test(`${entry.title} ${entry.description} ${entry.intro}`));
  assert.ok(named.length > 0);
  for (const post of named) assert.ok(laneLinksForPost(post).includes("nepal-to-tibet"), post.slug);
});

test("an air-freight note gets no corridor rather than a wrong one", () => {
  const air = blogPosts.filter((entry) => entry.topic === "air");
  assert.ok(air.length > 0);
  for (const post of air) assert.deepEqual(laneLinksForPost(post), [], post.slug);
});

test("every note's links are real lanes, in lane order, never more than two", () => {
  let linked = 0;
  for (const post of blogPosts) {
    const lanes = laneLinksForPost(post);
    assert.ok(lanes.length <= 2, `${post.slug} links ${lanes.length}`);
    assert.equal(new Set(lanes).size, lanes.length, `${post.slug} repeats a lane`);
    for (const slug of lanes) assert.ok(laneSlugs.includes(slug), `${post.slug} links unknown ${slug}`);
    const indexes = lanes.map((slug) => laneSlugs.indexOf(slug));
    assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b), `${post.slug} is out of lane order`);
    if (lanes.length) linked += 1;
  }
  assert.ok(linked >= 70, `only ${linked} of ${blogPosts.length} notes link a corridor`);
});

test("the mapping is deterministic for the same note", () => {
  for (const post of blogPosts.slice(0, 20)) {
    assert.deepEqual(laneLinksForPost(post), laneLinksForPost({ ...post }));
  }
});
