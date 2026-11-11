// Checks the ranking rules (web/src/scoring.ts), bundled on the fly with esbuild (already installed by Vite).
// Run: node tests/scoring.test.mjs   (part of npm test)
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = await build({ entryPoints: [path.join(root, "web/src/scoring.ts")], bundle: true, format: "esm", write: false, platform: "neutral" });
const { score } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);

let passed = 0;
let failed = 0;
const check = (ok, what) => (console.log(`${ok ? "  PASS" : "  FAIL"}  ${what}`), ok ? passed++ : failed++);

const P = (id, name, distance, bins = null) => ({ id, name, distance, bins });
const game = (players, teams, extra = {}) => ({ players, teams, entries: "both", rounds: ["distance"], ...extra });

console.log("\nPlaces go to people, teams are labels");
{
  // captain 9.00 m, solo pilot 8.90 m, captain's team-mates 7 m
  const players = [P("Pilot-01", "Cap", 9.0), P("Pilot-02", "Solo", 8.9), P("Pilot-03", "Mate1", 7.0), P("Pilot-04", "Mate2", 7.1)];
  const teams = [{ id: "Team-01", name: "Hawks", captain: "Pilot-01", members: ["Pilot-01", "Pilot-03", "Pilot-04"], requests: [] }];
  const s = score(game(players, teams));
  check(s.map((e) => e.name).join() === "Cap,Solo,Mate2,Mate1", `order: ${s.map((e) => e.name).join(", ")}`);
  check(s[0].team?.name === "Hawks" && !s[1].team, "the captain's line shows the team; the solo pilot has none");
  check(s.length === 4 && s.every((e) => e.of === 4), "everyone is ranked (4 of 4), team-mates too");

  // someone throws 9.10 m: they take 1st, whoever they fly with
  const s2 = score(game([...players, P("Pilot-05", "Rocket", 9.1)], teams));
  check(s2[0].name === "Rocket" && s2[1].name === "Cap" && s2[2].name === "Solo", "a 9.10 m throw takes 1st, the captain drops to 2nd, the solo pilot 3rd");
}

console.log("\nEvery flight scores (both rounds)");
{
  const players = Array.from({ length: 30 }, (_, i) => P(`Pilot-${i + 1}`, `P${i + 1}`, 10 - i * 0.2, 0));
  const s = score(game(players, [], { rounds: ["distance", "bin"] }));
  check(s[0].distPts === 30 && s[29].distPts === 1, `30 flights: longest gets ${s[0].distPts}, shortest gets ${s[29].distPts}`);
  check(s.every((e) => e.distPts > 0), "no flight scores 0");
  const withBin = score(game([P("A", "A", 5, 3), P("B", "B", 9, 0)], [], { rounds: ["distance", "bin"] }));
  check(withBin[0].name === "A" && withBin[0].total === 1 + 9 && withBin[1].total === 2, "bin points still count: 3 in the bin beats a longer flight");
}

console.log("\nTies and teams-only");
{
  const s = score(game([P("A", "A", 8), P("B", "B", 8)], []));
  check(s[0].rank === 1 && s[1].rank === 1 && s[0].tied && s[1].tied, "equal throws share the place (=1st) and ask for a throw-off");
  const s2 = score(game([{ ...P("A", "A", 8), tiebreak: 4 }, { ...P("B", "B", 8), tiebreak: 5 }], []));
  check(s2[0].name === "B" && !s2[0].tied, "the throw-off splits it");
  const teams = [{ id: "Team-01", name: "Hawks", captain: "A", members: ["A"], requests: [] }];
  const s3 = score(game([P("A", "A", 6), P("B", "B", 9)], teams, { entries: "teams" }));
  check(s3.length === 1 && s3[0].name === "A", "teams-only: players without a team aren't ranked");
  const s4 = score(game([P("A", "A", 6), P("B", "B", 9)], teams, { entries: "solo" }));
  check(s4.length === 2 && !s4.some((e) => e.team), "individuals-only: teams are ignored");
}

console.log(`\n${failed ? `${failed} FAILED, ` : ""}${passed} passed`);
process.exit(failed ? 1 : 0);
