import { rulesFor } from "./components/RuleSlides";
import { roundStatus } from "./queue";
import { phasesFor, roundTitle } from "./mode";
import type { GameState, Phase, Round } from "./types";

export type Step = {
  label: string;
  msg: object;
  // asked before moving on when something isn't finished yet
  confirm?: { title: string; body: string; ok: string };
};

const names = (list: { name: string }[]) =>
  list.length <= 4 ? list.map((p) => p.name).join(", ") : `${list.slice(0, 3).map((p) => p.name).join(", ")} and ${list.length - 3} more`;

const isRound = (p: Phase): p is Round => p === "distance" || p === "bin";

/** What a step is called on the Next/Back buttons. */
export function stepLabel(s: GameState, to: Phase) {
  if (isRound(to)) return `Start ${roundTitle(s, to)}`;
  return to === "winners" ? "On to the winners" : to === "rules" ? "Start: show the rules" : "Back to lobby";
}

/** What Next does from here. Rules go one slide at a time. Rounds that are switched off are skipped. */
export function nextStep(s: GameState): Step | null {
  const phases = phasesFor(s);
  const after = phases[phases.indexOf(s.phase) + 1];
  const rules = rulesFor(s);
  switch (s.phase) {
    case "lobby":
      return s.players.length === 0
        ? {
            label: stepLabel(s, "rules"),
            msg: { t: "phase", phase: "rules", from: s.phase },
            confirm: { title: "Nobody has joined yet", body: "Start the rules anyway? People can still join later.", ok: "Start" },
          }
        : { label: stepLabel(s, "rules"), msg: { t: "phase", phase: "rules", from: s.phase } };
    case "rules":
      return s.ruleStep < rules.length - 1
        ? { label: `Next rule: ${rules[s.ruleStep + 1].short}`, msg: { t: "rule", step: s.ruleStep + 1, from: s.ruleStep } }
        : { label: stepLabel(s, after), msg: { t: "phase", phase: after, from: s.phase } };
    case "distance":
    case "bin": {
      const { left, away, complete } = roundStatus(s);
      const label = stepLabel(s, after);
      const msg = { t: "phase", phase: after, from: s.phase };
      if (complete && away.length === 0) return { label, msg };
      const waiting = [...left, ...away];
      return {
        label,
        msg,
        confirm: {
          title: `${waiting.length} still to throw`,
          body: `${names(waiting)} ${waiting.length === 1 ? "hasn't" : "haven't"} thrown this round. Move on anyway? You can still fix their scores later with Edit.`,
          ok: "Move on",
        },
      };
    }
    default:
      return null;
  }
}

export function backStep(s: GameState): Step | null {
  const phases = phasesFor(s);
  const before = phases[phases.indexOf(s.phase) - 1];
  const lastRule = rulesFor(s).length - 1;
  switch (s.phase) {
    case "rules":
      return s.ruleStep > 0
        ? { label: "Back", msg: { t: "rule", step: s.ruleStep - 1, from: s.ruleStep } }
        : { label: "Back to lobby", msg: { t: "phase", phase: "lobby", from: s.phase } };
    case "distance":
    case "bin":
      return before === "rules"
        ? { label: "Back to rules", msg: { t: "phase", phase: "rules", ruleStep: lastRule, from: s.phase } }
        : { label: `Back to ${roundTitle(s, before as Round)}`, msg: { t: "phase", phase: before, from: s.phase } };
    case "winners":
      return {
        label: `Back to ${roundTitle(s, before as Round)}`,
        msg: { t: "phase", phase: before, from: s.phase },
        confirm: { title: "Leave the winners?", body: "The reveal starts again from the beginning next time.", ok: "Go back" },
      };
    default:
      return null;
  }
}
