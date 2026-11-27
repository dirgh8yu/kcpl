import assert from "node:assert/strict";
import test from "node:test";
import { laneLinksForPost, postsForLane } from "../app/blog-lane-links.ts";
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

/* The lane page lists the notes that link it. The rule is derived from
 * laneLinksForPost, so these tests hold the two directions together: a note the
 * lane page shows must link that lane, and a note that links a lane must appear
 * on that lane's page. */

test("every note a lane page lists is a note that links that lane", () => {
  for (const lane of laneSlugs) {
    for (const post of postsForLane(lane)) {
      assert.ok(laneLinksForPost(post).includes(lane), `${post.slug} is listed on ${lane} but does not link it`);
    }
  }
});

test("no note that links a corridor is orphaned from that corridor's page", () => {
  const linked = blogPosts.filter((post) => laneLinksForPost(post).length > 0);
  assert.ok(linked.length >= 70, `only ${linked.length} notes link a corridor`);
  for (const post of linked) {
    const listedOn = laneSlugs.filter((lane) => postsForLane(lane).some((entry) => entry.slug === post.slug));
    for (const lane of laneLinksForPost(post)) {
      assert.ok(listedOn.includes(lane), `${post.slug} links ${lane} but /lanes/${lane} does not list it`);
    }
  }
});

test("a lane page's notes are newest first and listed once", () => {
  for (const lane of laneSlugs) {
    const notes = postsForLane(lane);
    assert.ok(notes.length > 0, `${lane} lists no notes`);
    assert.equal(new Set(notes.map((post) => post.slug)).size, notes.length, `${lane} repeats a note`);
    const dates = notes.map((post) => post.published);
    assert.deepEqual(dates, [...dates].sort((a, b) => b.localeCompare(a)), `${lane} is not newest first`);
  }
});

test("a lane with no note to list would say so by returning nothing", () => {
  assert.deepEqual(postsForLane("kolkata-to-birgunj").filter((post) => !laneLinksForPost(post).includes("kolkata-to-birgunj")), []);
});

test("the mapping is deterministic for the same note", () => {
  for (const post of blogPosts.slice(0, 20)) {
    assert.deepEqual(laneLinksForPost(post), laneLinksForPost({ ...post }));
  }
});
