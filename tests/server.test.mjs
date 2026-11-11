// End-to-end checks for the game server: modes, teams, controllers, fair play.
//
// Needs a local game server with a known host password, e.g.
//   npx -w worker wrangler dev --port 8788 --var HOST_PASSWORD:plane-test --persist-to ../.wrangler-test
// then:  npm test            (or: API=http://localhost:8788 PASSWORD=plane-test node tests/server.test.mjs)

const API = process.env.API ?? "http://localhost:8788";
const PASSWORD = process.env.PASSWORD ?? "plane-test";
const WS = API.replace(/^http/, "ws");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
let failed = 0;
/** Waits up to 3 s for the condition, so a busy machine never fails a check on timing. */
async function check(fn, what) {
  let ok = false;
  for (let i = 0; i < 60 && !(ok = !!fn()); i++) await sleep(50);
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${what}`);
  ok ? passed++ : failed++;
}
const section = (name) => console.log(`\n${name}`);

function client(pin, hello) {
  const ws = new WebSocket(`${WS}/api/game/${pin}/ws`);
  const c = { ws, state: null, msgs: [], id: null, send: (m) => ws.send(JSON.stringify(m)) };
  ws.onmessage = (e) => {
    if (e.data === "pong") return;
    const m = JSON.parse(e.data);
    c.msgs.push(m);
    if (m.t === "state") c.state = m.state;
    if (m.t === "you") c.id = m.id;
  };
  return new Promise((res, rej) => {
    ws.onerror = rej;
    ws.onopen = () => {
      if (hello) c.send(hello);
      setTimeout(() => res(c), 250);
    };
  });
}
const lastErr = (c) => c.msgs.filter((m) => m.t === "error").map((m) => m.message).at(-1) ?? "";
const hostMsg = (c) => c.msgs.filter((m) => m.t === "host").at(-1);
const control = (pin, extra = {}) => client(pin, { t: "hello", role: "host", as: "control", password: PASSWORD, ...extra });

async function newGame(setup) {
  const res = await fetch(`${API}/api/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: PASSWORD, winners: 3, setup }),
  });
  if (!res.ok) throw new Error(`create failed: ${res.status}`);
  return (await res.json()).pin;
}

async function players(pin, names) {
  const out = {};
  for (const n of names) {
    out[n] = await client(pin, null);
    out[n].send({ t: "join", name: n, device: `dev-${n}-${pin}-xxxxxxxx`, fp: `fp-${n}` });
    await sleep(60);
  }
  for (const n of names) await check(() => out[n].id, `${n} joined`);
  return out;
}

// ---------------------------------------------------------------------------

async function modes() {
  for (const rounds of [["distance"], ["bin"], ["distance", "bin"]]) {
    section(`Challenges: ${rounds.join(" + ")}`);
    const pin = await newGame({ rounds, entries: "both", teamMax: 3 });
    const host = await control(pin);
    await check(() => host.state?.rounds.join() === rounds.join(), `game has rounds ${rounds.join(", ")}`);
    const P = await players(pin, ["Ann", "Ben", "Cat"]);
    const off = rounds.length === 1 ? (rounds[0] === "distance" ? "bin" : "distance") : null;
    if (off) {
      host.send({ t: "phase", phase: off, from: "lobby" });
      await sleep(200);
      await check(() => host.state.phase === "lobby", `can't jump to the switched-off ${off} round`);
    }
    for (const r of rounds) {
      host.send({ t: "phase", phase: r, from: host.state.phase });
      await check(() => host.state.phase === r && host.state.up === P.Ann.id, `round ${r} starts with Ann called`);
      if (r === "distance") {
        for (const [n, m] of [["Ann", 7.5], ["Ben", 9.1], ["Cat", 6.2]]) {
          host.send({ t: "distance", id: P[n].id, m });
          await check(() => host.state.players.find((p) => p.id === P[n].id).distance === m, `${n}'s ${m} m saved`);
        }
      } else {
        const max = rounds.includes("distance") ? 3 : 5;
        for (const [n, k] of [["Ann", 2], ["Ben", 1], ["Cat", 9]]) {
          for (let i = 0; i < k; i++) host.send({ t: "bin", id: P[n].id, dir: 1 });
          host.send({ t: "binDone", id: P[n].id });
          await check(() => host.state.players.find((p) => p.id === P[n].id).bins === Math.min(k, max), `${n}: ${Math.min(k, max)} in (max ${max})`);
        }
      }
      await check(() => host.state.up === null, `round ${r} complete`);
    }
    if (rounds.length === 1) {
      host.send({ t: "settings", setup: { rounds: ["distance", "bin"] } });
      await check(() => /locked/.test(lastErr(host)), "challenges locked after the first round");
    }
    host.send({ t: "phase", phase: "winners", from: host.state.phase });
    await check(() => host.state.phase === "winners", "on to the winners");
  }
}

async function teams(entries) {
  section(`Teams (${entries})`);
  const pin = await newGame({ rounds: ["distance"], entries, teamMax: 3 });
  const host = await control(pin);
  const P = await players(pin, ["Ann", "Ben", "Cat", "Dan", "Eve", "Fay"]);
  const team = (name) => host.state.teams.find((t) => t.name === name);

  P.Ben.send({ t: "createTeam", name: "Hawks" });
  await check(() => team("Hawks")?.captain === P.Ben.id, "Ben starts Hawks and is captain");
  P.Ann.send({ t: "createTeam", name: "hawks" });
  await check(() => /already a team/.test(lastErr(P.Ann)), "duplicate team name refused");
  P.Cat.send({ t: "requestTeam", team: team("Hawks").id });
  P.Dan.send({ t: "requestTeam", team: team("Hawks").id });
  await check(() => team("Hawks").requests.length === 2, "Cat and Dan ask to join");
  P.Cat.send({ t: "answerRequest", id: P.Dan.id, ok: true });
  await sleep(150);
  await check(() => !team("Hawks").members.includes(P.Dan.id), "only the captain can accept");
  P.Ben.send({ t: "answerRequest", id: P.Dan.id, ok: false });
  P.Ben.send({ t: "answerRequest", id: P.Cat.id, ok: true });
  await check(() => team("Hawks").members.join() === [P.Ben.id, P.Cat.id].join() && !team("Hawks").requests.length, "captain accepts Cat, declines Dan");
  P.Eve.send({ t: "requestTeam", team: team("Hawks").id });
  P.Fay.send({ t: "requestTeam", team: team("Hawks").id });
  await check(() => team("Hawks").requests.length === 2, "Eve and Fay ask");
  P.Ben.send({ t: "answerRequest", id: P.Eve.id, ok: true });
  await check(() => team("Hawks").members.length === 3, "Eve accepted (team now full)");
  P.Ben.send({ t: "answerRequest", id: P.Fay.id, ok: true });
  await check(() => /full/.test(lastErr(P.Ben)) && team("Hawks").members.length === 3, "team size limit enforced");
  P.Ben.send({ t: "leaveTeam" });
  await check(() => team("Hawks").captain === P.Cat.id && team("Hawks").members.length === 2, "captain leaves: next member is captain");
  P.Ben.send({ t: "requestTeam", team: team("Hawks").id });
  await check(() => team("Hawks").requests.includes(P.Ben.id), "Ben asks to come back");
  P.Cat.send({ t: "answerRequest", id: P.Ben.id, ok: true });
  await check(() => team("Hawks").members.includes(P.Ben.id), "new captain lets Ben back in");
  P.Dan.send({ t: "createTeam", name: "Gliders" });
  await check(() => team("Gliders"), "Dan starts Gliders");
  host.send({ t: "setTeam", id: P.Fay.id, team: team("Gliders").id });
  await check(() => team("Gliders").members.includes(P.Fay.id), "host moves Fay in without the captain");

  host.send({ t: "phase", phase: "rules", from: "lobby" });
  await check(() => host.state.phase === "rules", "rules");
  host.send({ t: "phase", phase: "distance", from: "rules" });
  await check(() => host.state.phase === "distance", "round starts");
  P.Ann.send({ t: "createTeam", name: "Late" });
  await check(() => /locked/.test(lastErr(P.Ann)), "teams lock when throwing starts");

  const name = (id) => host.state.players.find((p) => p.id === id)?.name;
  const order = [];
  const dist = { Ann: 8, Ben: 6, Cat: 9, Dan: 5, Eve: 3, Fay: 7 };
  for (let i = 0; i < 8 && host.state.up; i++) {
    const up = host.state.up;
    order.push(name(up));
    host.send({ t: "distance", id: up, m: dist[name(up)] });
    await check(() => host.state.up !== up, `${name(up)} throws`);
  }
  // Hawks are Cat, Eve, Ben (team order) and come up at Ben's join slot; Ann flies solo (not in teams-only)
  const expect = entries === "teams" ? "Cat,Eve,Ben,Dan,Fay" : "Ann,Cat,Eve,Ben,Dan,Fay";
  await check(() => order.join() === expect, `team-mates called one after another: ${order.join(", ")}`);
}

async function teamEdges() {
  section("Team edge cases + team size");
  const pin = await newGame({ rounds: ["distance"], entries: "both", teamMax: 3 });
  const host = await control(pin);
  const P = await players(pin, ["Ann", "Ben", "Cat", "Dan", "Eve"]);
  const team = (name) => host.state.teams.find((t) => t.name === name);

  P.Ann.send({ t: "createTeam", name: "Solo Squad" });
  await check(() => team("Solo Squad"), "Ann starts a team");
  P.Ann.send({ t: "leaveTeam" });
  await check(() => !team("Solo Squad"), "captain alone leaves: team deleted");
  P.Ben.send({ t: "createTeam", name: "Hawks" });
  await check(() => team("Hawks"), "Ben starts Hawks");
  P.Cat.send({ t: "requestTeam", team: team("Hawks").id });
  await check(() => team("Hawks").requests.length === 1, "Cat asks");
  P.Ben.send({ t: "answerRequest", id: P.Cat.id, ok: true });
  await check(() => team("Hawks").members.length === 2, "Cat in");
  P.Ben.send({ t: "leaveTeam" });
  await check(() => team("Hawks")?.captain === P.Cat.id, "captain leaves: Cat takes over");
  P.Cat.send({ t: "leaveTeam" });
  await check(() => !team("Hawks"), "last member leaves: team deleted");

  P.Dan.send({ t: "createTeam", name: "Gliders" });
  await check(() => team("Gliders"), "Dan starts Gliders");
  P.Eve.send({ t: "requestTeam", team: team("Gliders").id });
  await check(() => team("Gliders").requests.length === 1, "Eve asks");
  P.Dan.send({ t: "leaveTeam" });
  await check(() => !host.state.teams.some((t) => t.requests.includes(P.Eve.id)), "request disappears with the team");
  P.Dan.send({ t: "createTeam", name: "Gliders" });
  await check(() => team("Gliders"), "Gliders again");
  P.Eve.send({ t: "requestTeam", team: team("Gliders").id });
  await check(() => team("Gliders").requests.length === 1, "Eve asks again");
  host.send({ t: "remove", id: P.Eve.id });
  await check(() => team("Gliders").requests.length === 0, "removed player's request is dropped");

  host.send({ t: "settings", setup: { rounds: ["distance"], entries: "both", teamMax: 2, teamPrize: "shared" } });
  await check(() => /can only go up/.test(lastErr(host)) && host.state.teamMax === 3, "team size can't shrink once teams exist");
  host.send({ t: "settings", setup: { rounds: ["distance"], entries: "both", teamMax: 5, teamPrize: "shared" } });
  await check(() => host.state.teamMax === 5, "team size can grow");
  P.Ann.send({ t: "requestTeam", team: team("Gliders").id });
  await check(() => team("Gliders").requests.includes(P.Ann.id), "Ann asks to join Gliders");
  host.send({ t: "phase", phase: "rules", from: "lobby" });
  await sleep(200);
  await check(() => team("Gliders").requests.length === 1, "requests survive into the rules");
  host.send({ t: "phase", phase: "distance", from: "rules" });
  await check(() => team("Gliders").requests.length === 0, "pending requests cleared when the first round starts");
  P.Dan.send({ t: "answerRequest", id: P.Ann.id, ok: true });
  await sleep(200);
  await check(() => !team("Gliders").members.includes(P.Ann.id), "can't accept after teams lock");
  host.send({ t: "settings", setup: { rounds: ["distance"], entries: "both", teamMax: 6, teamPrize: "each" } });
  await check(() => host.state.teamMax === 6 && host.state.teamPrize === "each", "team size and team prize can still change mid-event");
  host.send({ t: "settings", setup: { rounds: ["distance", "bin"], entries: "both", teamMax: 6, teamPrize: "each" } });
  await check(() => /locked/.test(lastErr(host)) && host.state.rounds.join() === "distance", "challenges stay locked");
}

async function controllers() {
  section("Control phones");
  const pin = await newGame({ rounds: ["distance"], entries: "both", teamMax: 3 });
  const admin = await control(pin, { name: "Pritom" });
  const a = hostMsg(admin);
  await check(() => a?.ok && a.admin && a.ctrlKey && a.ctrlId, "host password: admin controller with its own key");
  await check(() => admin.state.ctrl.length === 1 && admin.state.ctrl[0].name === "Pritom" && admin.state.invite?.length === 6, "controller list + invite visible to hosts");
  const again = await client(pin, { t: "hello", role: "host", as: "control", ctrlKey: a.ctrlKey });
  await check(() => hostMsg(again)?.ok && admin.state.ctrl.length === 1, "reconnect with the key: no password, no duplicate");
  again.ws.close();

  const invite = admin.state.invite;
  const helper = await client(pin, { t: "hello", role: "host", as: "control", invite, name: "Sam" });
  const h = hostMsg(helper);
  await check(() => h?.ok && !h.admin, "invite link: helper (not admin), no password");
  const bad = await client(pin, { t: "hello", role: "host", as: "control", invite: "ZZZZZZ" });
  await check(() => hostMsg(bad)?.ok === false, "wrong invite refused");
  helper.send({ t: "controllerRemove", id: a.ctrlId });
  await check(() => /Only the host/.test(lastErr(helper)), "helper can't remove controllers");
  helper.send({ t: "newInvite" });
  await check(() => helper.msgs.filter((m) => m.t === "error").length >= 2, "helper can't make invites");
  admin.send({ t: "newInvite" });
  await check(() => admin.state.invite !== invite, "host makes a new invite");
  const old = await client(pin, { t: "hello", role: "host", as: "control", invite });
  await check(() => hostMsg(old)?.ok === false, "old invite link stops working");

  const sam2 = await client(pin, { t: "hello", role: "host", as: "control", invite: admin.state.invite, name: "Sam 2" });
  const s2 = hostMsg(sam2);
  await check(() => s2?.ok, "second helper joins with the new invite");
  const theirLink = admin.state.invite;
  admin.send({ t: "controllerRemove", id: s2.ctrlId });
  await check(() => hostMsg(sam2)?.ok === false && hostMsg(sam2)?.reason === "removed", "removed helper is told and cut off");
  await check(() => !admin.state.ctrl.some((c) => c.id === s2.ctrlId), "removed helper is off the list");
  const reuse = await client(pin, { t: "hello", role: "host", as: "control", invite: theirLink });
  await check(() => hostMsg(reuse)?.ok === false, "removed helper can't reuse their invite link");
  const back = await client(pin, { t: "hello", role: "host", as: "control", ctrlKey: s2.ctrlKey });
  await check(() => hostMsg(back)?.ok === false, "removed helper can't reconnect with its key");
  sam2.send({ t: "phase", phase: "rules", from: "lobby" });
  await sleep(250);
  await check(() => admin.state.phase === "lobby", "removed helper's old connection can't run the event");
}

async function fairPlay() {
  section("Fair play");
  const pin = await newGame({ rounds: ["distance"], entries: "both", teamMax: 3 });
  const admin = await control(pin);
  const a = await client(pin, null);
  a.send({ t: "join", name: "Zed", device: "device-aaaaaaaaaaaaaaaa", fp: "fp1" });
  await check(() => a.id, "join with a device key");
  const a2 = await client(pin, null);
  a2.send({ t: "join", name: "Zed Again", device: "device-aaaaaaaaaaaaaaaa", fp: "fp1" });
  await check(() => a2.id === a.id && /already joined as Zed/.test(lastErr(a2)), "same browser can't make a second pilot (gets its pass back)");
  const b = await client(pin, null);
  b.send({ t: "join", name: "Yan", device: "device-bbbbbbbbbbbbbbbb", fp: "fp1" });
  await check(() => b.id && b.id !== a.id, "another browser with the same hardware is allowed (could be the same model)");
  await check(() => admin.state.players.find((p) => p.id === b.id)?.twin?.includes(a.id), "host sees a 'same phone?' flag");
  await check(() => b.state && !b.state.players.some((p) => p.twin || p.device || p.fp || p.net), "players never see device data or flags");

  const spam = await client(pin, null);
  spam.send({ t: "join", name: "Spammy", device: "device-cccccccccccccccc", fp: "fp9" });
  await check(() => spam.id, "spammer joins");
  for (let i = 0; i < 80; i++) spam.send({ t: "cancelRequest" });
  await check(() => /lot of taps/.test(lastErr(spam)), "message flood is slowed down");
  const count = admin.state.players.length;
  const big = await client(pin, null);
  big.ws.send(JSON.stringify({ t: "join", name: "x".repeat(6000) }));
  await sleep(300);
  await check(() => admin.state.players.length === count && !big.id, "oversized message ignored");
}

async function entriesClose() {
  section("Entries close during the winners reveal");
  const pin = await newGame({ rounds: ["distance"], entries: "both", teamMax: 3 });
  const host = await control(pin);
  const P = await players(pin, ["Ann"]);
  host.send({ t: "phase", phase: "winners", from: "lobby" });
  await check(() => host.state.phase === "winners", "on to the winners");
  const late = await client(pin, null);
  late.send({ t: "join", name: "Latecomer", device: "dev-late-xxxxxxxxxxxx" });
  await check(() => late.msgs.some((m) => m.t === "error" && m.closed), "new players refused while the winners are shown");
  const back = await client(pin, null);
  back.send({ t: "join", name: "Ann", device: `dev-Ann-${pin}-xxxxxxxx` });
  await check(() => back.id === P.Ann.id, "someone who already joined still gets their pass back");
  host.send({ t: "phase", phase: "distance", from: "winners" });
  await check(() => host.state.phase === "distance", "host goes back to the round");
  late.send({ t: "join", name: "Latecomer", device: "dev-late-xxxxxxxxxxxx" });
  await check(() => late.id, "entries open again");
}

try {
  await modes();
  await entriesClose();
  await teams("both");
  await teams("teams");
  await teamEdges();
  await controllers();
  await fairPlay();
} catch (e) {
  console.error(`\nCould not run against ${API}: ${e.message}\nStart the local game server first (see the top of this file).`);
  process.exit(2);
}
console.log(`\n${failed ? `${failed} FAILED, ` : ""}${passed} passed`);
process.exit(failed ? 1 : 0);
