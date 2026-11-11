// Names shown around the app. Change them here.
export const EVENT = {
  title: "Paper Plane Contest",
  hostedBy: "Deakin College",
  when: "Wednesday 11 November · 3–4pm · Atrium", // shown on the result photo
};

export const SCORING = {
  // Both rounds on: every flight scores one point for each flight it beats, plus one.
  binPoints: 3, // per plane in the bin (only when both challenges run)
  binThrows: 3, // bin throws per entry when the distance round runs too
  binOnlyThrows: 5, // bin throws when the bin is the only challenge (more throws, fewer ties). Also change worker/src/index.ts
};

// What a new game starts with on the create screen. Today's announcement: "who can fly the furthest?",
// prizes for 1st, 2nd and 3rd, teams or individuals allowed.
export const DEFAULT_SETUP = {
  rounds: ["distance"] as ("distance" | "bin")[],
  entries: "both" as "solo" | "teams" | "both",
  teamMax: 4,
  winners: 3,
};

// Shown on the recycling rule, the phones after the reveal and the big screen at the end.
export const RECYCLE = {
  title: "Recycle your plane",
  text: "When you're done, take your plane with you and drop it in a yellow Recycling bin. Clean paper only: no food, wrappers or coated cups.",
  short: "Take your plane with you and drop it in a yellow Recycling bin on your way out.",
};

// Shown on the last rule slide.
export const PERKS = "Prizes for the top {W}. Snacks and materials for everyone who takes part!";
