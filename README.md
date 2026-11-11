# Paper Plane Challenge

A live, Kahoot-style show for the Paper Plane Challenge (Wednesday 3–4pm), hosted by the Deakin Student Committee. Everyone folds a real plane and throws it; the app calls each pilot up, keeps score, and runs the show on the projector. No logins for players, no paid services.

| Screen | Who | What |
|---|---|---|
| `/host` | laptop on the projector | **Display only.** Shows what's happening right now. Each step has its own address: `/host/lobby`, `/host/rules`, `/host/round1-distance`, `/host/round2-bin`, `/host/winner` |
| `/control` | the host's phone | **Runs everything**: steps, rules, calling pilots, metres, bin hits, Skip / Not here, Edit, Undo, the reveal, settings. Its **Guide** button shows this README. Needs the PIN + host password |
| `/guide` | anyone | This README, readable on a phone |
| `/join` | players | What the QR opens. Name (or team name + members) → pass with an ID like **Pilot-07** or **Team-08** and a rejoin code |
| `/results` | everyone | All players and their points, searchable. Opens after the last winner is revealed (QR on the big screen) |

The event name and "hosted by" line are in `web/src/config.ts`.

```
web/      Vite + React + TypeScript   → Cloudflare Pages
worker/   Worker + one Durable Object per game PIN (holds state, pushes updates over WebSockets)
scripts/  start.mjs, used by start.bat
```

## Challenges and teams

Set these on the **Create game** screen. You can change them in the control **Menu** until the first round starts; after that they're locked.

**Challenges.** Tick **Longest throw**, **Bin throw** or both. At least one has to be ticked. The rules slides, the steps on the big screen, Next/Back and the scores all follow what you pick.

| Ticked | How it's scored |
|---|---|
| Longest throw only (the default: "who can fly the furthest?") | One throw each. Ranked by metres; the longest flight wins |
| Bin throw only | 5 throws at the bin. Ranked by planes in |
| Both | Round 1 distance, then round 2 bin (3 throws). Points added up, see below |

**Who can enter.** **Both** (the default), **Individuals** or **Teams**, plus the biggest team size (2 to 6, default 4). One phone joins for the whole team: they tap **We're a team** and type a team name and everyone's names. Teams get IDs like **Team-03**, and their member names show on the big screen.

**Fair for solo pilots.** A team is one entry: one plane, one turn, scored exactly like a solo pilot. A bigger team gets no extra throws. The team picks who throws (and can share the bin throws).

## Scoring (both challenges on)

| | |
|---|---|
| Distance | The 10 longest throws score 10, 9, 8 … 1 (equal throws share points) |
| Bin | 3 throws, 3 points per plane in the bin (max 9) |
| Total | Distance + bin. On a tie, the longer flight wins |
| Winners | You choose 3 to 10 when creating the game (default 3, for the 1st/2nd/3rd prizes; changeable later in the control Menu) |

**With 30 students:** only the 10 longest flights get distance points; the other 20 get 0 for distance but can still win through the bin. To change it, set `distancePlaces` in `web/src/config.ts` (e.g. 30 = every flight scores, but distance then outweighs the bin a lot).

**Exact ties** (same result on what's being ranked): they share the place ("=1st"). The big screen shows **Tie!**, and the control phone shows a **throw-off** box: one more throw each, type the metres, longest wins.

Defaults for new games, the number of bin throws and the "prizes + snacks" line on the last rule are in `web/src/config.ts`.

## Quickest way: double-click `start.bat`

No Cloudflare account and no deploying. Your laptop runs everything, and a free Cloudflare **quick tunnel** gives it a public `https://xxxx.trycloudflare.com` link that works on any Wi-Fi or mobile data.

1. Double-click **start.bat**. The first run installs the packages and `cloudflared` (via winget).
2. **Choose a host password** for today (what you type is hidden; avoid `"` `\` `$`).
3. The big screen opens. Type the password, pick **how many winners**, the **challenges** and **who can enter**, then click **Create game**. Write the **PIN** down.
4. The big screen says **"Connect your control phone now"**: scan its QR with your phone, enter the password. The big screen moves on to the lobby by itself.
5. Press **F** on the laptop for full screen (move the mouse for the corner Menu: full screen, sound, controls on the laptop).

Keep the black window open and the laptop plugged in and awake. Quick tunnels have no uptime guarantee; fine for a one-hour event.

## Running the event (all from the control phone)

The bottom of the control phone always has **← Back** and **Next →**, labelled with what they'll do. Nothing important happens without you pressing them.

1. **Lobby**: people scan the big QR and join as themselves or as a team. Their name tags pop onto the wall (with a sound). Fix silly names or team members with **Edit**.
2. **Rules**: Next/Back steps one rule at a time (each with its own drawing on the big screen); or tap any rule to jump.
3. **Distance** (Round 1 when both challenges are on): the app calls pilots and teams one by one: big name on the screen, "You're up!" + buzz + sound on their phone, "You're next" on the next one. Measure from the line to where the plane stopped (tape or iPhone **Measure**), type the metres, **Save: next pilot**. The big screen shows the landing, then the next name.
4. When everyone has thrown, the phone pops up **"Everyone has thrown!"** and offers the next step.
5. **Bin** (if it's on): tap **+** for each plane in, then **Done: next**.
6. **Winners**: **Reveal 5th place** (and so on), or **Reveal all the rest**. Each place gets a taiko drumroll and "And in 3rd place…" on the big screen, then the card drops in with a spotlight, a red place seal, confetti and sound; 1st gets the fanfare. Winners' phones celebrate at the same moment (never earlier). Then a QR for **everyone's results** appears.

## When things go wrong

| What happened | What to do |
|---|---|
| Typed the wrong metres / wrong person | **Undo** (bar at the bottom, 10 s) puts it back and calls them again. Later: **Edit** them (pilot list, or Menu → Standings) |
| Pilot not at the line | **Skip for now** (back of the queue) or **Not here** (out of this round; **Back** when they return) |
| Pilot arrives late | They just join; they're queued automatically. Missed round 1? Type their distance with **Edit** |
| Pilot changed phone or browser | Join with the **same name + rejoin code** (they're asked to screenshot it when they join). Lost it? **Edit** shows it |
| Rude or duplicate name | **Edit** → rename, or **Remove pilot** (Undo / Menu → Bring back if it was a mistake) |
| Team joined with a wrong or missing name | **Edit** → Team members (separated by commas). Clearing them all makes it a solo entry |
| A team member joined on their own as well | **Remove pilot** for the solo entry: a team has one plane and one turn |
| Wrong challenges picked | Control **Menu → Challenges and teams**, any time before the first round starts |
| Pressed Next too early | **Back**. Nothing is lost |
| Revealed too early | **Hide and start the reveal again** |
| Tie for a winning place | Throw-off box on the control phone |
| Fewer scorers than winners | Empty places say "no 5th" |
| Control phone screen locks | The control page keeps the screen awake while it's open. If the phone is in Low Power / Battery Saver mode it may still lock: unlock it and it reconnects by itself. Safest: set Auto-Lock to "Never" for the hour |
| Control phone dies, closes the tab, or gets a call | Open `/control` again (it remembers the PIN + password on that phone) or on any other phone, or the laptop's corner **Menu → Open the controls**. The audience never sees a warning; the laptop's corner Menu shows how many control phones are connected |
| Two control phones / double taps | Several controls at once is fine. A step change that arrives after the event already moved on (double-tapped Next, two people pressing at once, a leftover "Start Round 2?" pop-up) is ignored, so the event never jumps two steps. Skip only ever skips the person on screen |
| Phone signal blips mid-tap | Taps are kept and sent when it reconnects (stale ones are ignored, see above) |
| Laptop / start.bat restarted (new link) | Run start.bat, then on the big screen **Resume a game** with the PIN + password. Scores are kept. Players rejoin with name + code |
| No sound on the big screen | Click anywhere on it once (browsers need one click) |
| Start completely fresh | Control **Menu → Reset event**: same PIN and QR, everyone joins again |

## Sounds

Short sound effects live in `web/public/sfx/` (`up`, `next`, `land`, `bin`, `whoosh`, `tear`, `drumroll`, `reveal`, `fanfare`, `pop`, `cheer`). Replace any `.mp3` to change it. If a file is missing, a built-in synthesised version plays instead. Phones have a sound on/off button; the big screen's is in its corner Menu. There's no background music track.

## Run it locally (development)

```bash
npm install
```

```bash
npm run dev
```

Worker on port 8787, web app on 5173. Open `http://localhost:5173/host`. For real phones, use the laptop's *Network* address Vite prints (or a phone hotspot).

## Deploy to Cloudflare (free, permanent link)

The "backend" is the Worker in `worker/`. Cloudflare runs it; you upload it once.

```bash
npx wrangler login
```

```bash
npx -w worker wrangler secret put HOST_PASSWORD
```

```bash
npm run deploy -w worker
```

Copy the Worker URL it prints, put it in `web/.env.production` as `VITE_API_URL=https://paper-plane-api.<your-subdomain>.workers.dev`, then:

```bash
npm run build
```

```bash
npx wrangler pages deploy web/dist --project-name paper-plane-challenge
```

Free plan: Workers, Pages and the SQLite-backed Durable Object are all included.

## Design notes

Sports-day noticeboard on squared exercise paper with airmail trim, plus an origami/Japanese feel without lettering: indigo seigaiha waves, washi paper, red seal stamps, a taiko drumroll. Fonts: Bowlby One, Barlow Condensed, Barlow, Gochi Hand. Animations switch off for reduced motion.

See [TESTING.md](TESTING.md) for the pre-event checklist.
