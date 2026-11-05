export const movementStories = [
  { number: 1, slug: "infrastructure" },
  { number: 2, slug: "air-export", bend: [1, 3] },
  { number: 3, slug: "western-nepal" },
] as const;

export type MovementSlug = (typeof movementStories)[number]["slug"];
