// Names shown around the app. Change them here.
export const EVENT = {
  title: "Paper Plane Challenge",
  hostedBy: "Deakin Student Committee",
};

export const SCORING = {
  // How many of the longest flights score distance points. With 10: longest = 10, next = 9 … 10th = 1,
  // everyone after that gets 0 distance points (but can still score in the bin round).
  // Set it to the class size (e.g. 30) if you want every flight to score something.
  distancePlaces: 10,
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

// Shown on the last rule slide.
export const PERKS = "Prizes for the top {W}. Snacks for everyone who takes part!";
