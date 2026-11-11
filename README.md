# YGYR: Your Game, Your Rules

**Run your own live contest: your rules, your challenges, your branding.** Players join from their phones with a QR code, the big screen runs the show, and one phone controls everything. No logins for players, no paid services.

The first game is the **Paper Plane Contest** (Deakin College, in association with Deakin University: Wednesday 11 November, 3–4pm, in the Atrium): fold a plane, throw it, see who flies the furthest. Snacks and materials provided, prizes for 1st, 2nd and 3rd, teams or individuals welcome. The event name, host and date line are in `web/src/config.ts`.

Coming later: build any contest with your own rules, content, theme and branding, and host it yourself.

## Get it on any Windows PC

1. On GitHub: **Code → Download ZIP** and unzip it (or `git clone https://github.com/pritombarua1/YGYR.git`).
2. Double-click **`start.bat`**. That's it.

The first run installs anything the PC is missing (**Node.js**, **Git**, **cloudflared**, then the app's packages) using winget, which is built into Windows 10 and 11. Windows may ask for permission once per install: click **Yes**. If it says Node.js was installed but can't be seen yet, close the window and double-click `start.bat` again.

**Updates are automatic.** Every time `start.bat` runs, it pulls the latest version from GitHub first. A ZIP download gets linked to GitHub on its first run, so it updates too. While the event is running, **Menu → Check for updates** (on the laptop's corner Menu or the control phone) pulls the latest version, rebuilds and restarts the game. It takes about a minute. The public link, the players and the scores are kept, and screens reconnect by themselves. Best done before the event starts, not mid-round.

## Free to use: just give credit

YGYR is free and open for anyone: use it, copy it, change it, run your own events. It's under the [MIT licence](LICENSE). The one condition is that you keep the copyright notice, which means **giving credit to Pritom Barua** (a shoutout and a link back here is perfect).

| Screen | Who | What |
|---|---|---|
| `/host` | laptop on the projector | **Display only.** Shows what's happening right now. Each step has its own address: `/host/lobby`, `/host/rules`, `/host/round1-distance`, `/host/round2-bin`, `/host/winner` |
| `/control` | the host's phone | **Runs everything**: steps, rules, calling pilots, metres, bin hits, Skip / Not here, Edit, Undo, the reveal, settings. Its **Guide** button shows this README. Needs the PIN + host password |
| `/guide` | anyone | This README, readable on a phone |
| `/join` | players | What the QR opens. Name → pass with an ID like **Pilot-07** and a rejoin code. Then (optional) start a team or ask to join one |
| `/results` | everyone | Everyone's results, searchable (a team-mate's name finds their team, and team rows show each member's throw). Opens after the last winner is revealed (QR on the big screen) |

The event name and "hosted by" line are in `web/src/config.ts`.

```
web/      Vite + React + TypeScript   → Cloudflare Pages
worker/   Worker + one Durable Object per game PIN (holds state, pushes updates over WebSockets)
scripts/  start.mjs, used by start.bat
```

## Rounds and teams

Set these on the **Create game** screen. You can change them in the control **Menu** until the first round starts; after that they're locked.

**Rounds.** Tick **Longest throw**, **Bin throw** or both. At least one has to be ticked. The rules slides, the steps on the big screen, Next/Back and the scores all follow what you pick.

| Ticked | How it's scored |
|---|---|
| Longest throw only (the default: "who can fly the furthest?") | One throw each. Ranked by metres; the longest flight wins |
| Bin throw only | 5 throws at the bin. Ranked by planes in |
| Both | Round 1 distance, then round 2 bin (3 throws). Points added up, see below |

**Who can enter.** **Both** (the default), **Individuals** or **Teams**, plus the biggest team size (2 to 6, default 4).

**How teams work.** Everyone joins on their own phone, as themselves. Then, on their pass (in the Lobby or during the Rules):
- **Start a team**: type a name. You're the **captain**.
- **Ask to join** a team from the list (search it by team name or a friend's name). The captain's phone pops up the request (with a sound) and they tap **Accept** or **Decline**. You can cancel while you wait.
- The captain can **Remove** members. Anyone can **Leave team**; if the captain leaves, the next member becomes captain, and when the last person leaves the team is deleted.
- Team-mates can each fold their own plane or pass one plane along the team: their choice.
- **Team size** can be raised at any time (control **Menu**), but never lowered once a team exists, so nobody gets pushed out. Requests still waiting when the first round starts are cleared.
- Teams lock when the first round starts. The host can still fix anything: **Edit** a player to move them into a team, take them out or start a new team, without the captain's OK. In the control Lobby, **Teams** → **Edit** renames a team or breaks it up.

Teams are called **in team formation**: when a team comes up, its members throw one after another, and the big screen shows the whole team with who's done, who's throwing and who's next. In **Teams only** events, players who aren't in a team aren't called; the control phone lists them.

**Places go to people, not teams.** Everyone is ranked on their **own** throw; a team is who you fly with (called together, shown together), not a merged score. Example: a team captain throws 9.00 m, a solo pilot 8.90 m, the captain's team-mates 7 m. The captain is 1st, the solo pilot 2nd, the team-mates place on their own 7 m throws. If anyone (solo or in any team) throws 9.10 m, they're 1st.

## Prizes

One prize per place, always: with 3 winners that's 3 prizes, given to the **person** who threw it (their team is shown next to their name, so the team can come up for the photo). Everyone else sees their own place ("12th of 30") with a thank-you, and snacks are for everyone. The control phone's winners list shows how many prizes to hand out.

## Scoring (both rounds on)

| | |
|---|---|
| Distance | Every flight scores: one point for each flight it beats, plus one (with 30 flights: longest 30, shortest 1; equal flights share points) |
| Bin | 3 throws, 3 points per plane in the bin (max 9) |
| Total | Distance + bin. On a tie, the longer flight wins |
| Winners | You choose 3 to 10 when creating the game (default 3, for the 1st/2nd/3rd prizes; changeable later in the control Menu) |

**Exact ties** (same result on what's being ranked): they share the place ("=1st"). The big screen shows **Tie!**, and the control phone shows a **throw-off** box: one more throw each, type the metres, longest wins.

Defaults for new games, the number of bin throws and the "prizes + snacks" line on the last rule are in `web/src/config.ts`.

## Quickest way: double-click `start.bat`

No Cloudflare account and no deploying. Your laptop runs everything, and a free Cloudflare **quick tunnel** gives it a public `https://xxxx.trycloudflare.com` link that works on any Wi-Fi or mobile data.

1. Double-click **start.bat**. It installs anything missing and pulls the latest version (see "Get it on any Windows PC").
2. **Choose a host password** for today (what you type is hidden; avoid `"` `\` `$`).
3. The big screen opens. Type the password, pick **how many winners**, the **challenges** and **who can enter**, then click **Create game**. Write the **PIN** down.
4. The big screen says **"Connect your control phone now"**: scan its QR with your phone, enter the password. The big screen moves on to the lobby by itself.
5. Press **F** on the laptop for full screen (move the mouse for the corner Menu: full screen, sound, controls on the laptop, updates).

Keep the black window open and the laptop plugged in and awake. Quick tunnels have no uptime guarantee; fine for a one-hour event.

## Running the event (all from the control phone)

The bottom of the control phone always has **← Back** and **Next →**, labelled with what they'll do. Nothing important happens without you pressing them.

1. **Lobby**: people scan the big QR and join. Their name tags pop onto the wall (with a sound), team-mates side by side. Friends start a team or ask to join one on their phones. Fix silly names or teams with **Edit**.
2. **Rules**: Next/Back steps one rule at a time (each with its own drawing on the big screen); or tap any rule to jump.
3. **Distance** (Round 1 when both challenges are on): the app calls pilots one by one (team-mates one after another): big name on the screen, "You're up!" + buzz + sound on their phone, "You're next" on the next one. Measure from the line to where the plane stopped (tape or iPhone **Measure**), type the metres, **Save: next pilot**. The big screen shows the landing, then the next name.
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
| Someone's in the wrong team, or the captain isn't answering | **Edit** the player → **Team**: move them in or out (no captain's OK needed), or start a new team |
| A team needs renaming or splitting up | Control Lobby → **Teams** → **Edit** → rename, or **Break up team** (everyone keeps their own throws) |
| Teams only, but someone has no team | The control Lobby lists them. **Edit** them → pick a team |
| Wrong rounds picked | Control **Menu → Rounds and teams**, any time before the first round starts |
| Someone wants to join during the winners | Entries close while the podium is up (the late-join QR is replaced by "Entries closed"). Going **Back** to a round reopens them. People who already joined still get their pass back |
| Pressed Next too early | **Back**. Nothing is lost |
| Revealed too early | **Hide and start the reveal again** |
| Tie for a winning place | Throw-off box on the control phone |
| Fewer scorers than winners | Empty places say "no 5th" |
| Control phone screen locks | The control page keeps the screen awake while it's open. If the phone is in Low Power / Battery Saver mode it may still lock: unlock it and it reconnects by itself. Safest: set Auto-Lock to "Never" for the hour |
| Control phone dies, closes the tab, or gets a call | Open `/control` again (it remembers the PIN + password on that phone) or on any other phone, or the laptop's corner **Menu → Open the controls**. The audience never sees a warning; the laptop's corner Menu shows how many control phones are connected |
| Two control phones / double taps | Several controls at once is fine. A step change that arrives after the event already moved on (double-tapped Next, two people pressing at once, a leftover "Start Round 2?" pop-up) is ignored, so the event never jumps two steps. Skip only ever skips the person on screen |
| Phone signal blips mid-tap | Taps are kept and sent when it reconnects (stale ones are ignored, see above) |
| start.bat says "Another copy of the contest is already running" | An older window (or one that crashed) still holds the ports. **Y** stops it and starts fresh (players and scores are kept); **N** leaves it running, so use that window. If a server ever stops, start.bat now prints its last messages so you can see why |
| Laptop / start.bat restarted (new link) | Run start.bat, then on the big screen **Resume a game** with the PIN + password. Scores are kept. Players rejoin with name + code |
| No sound on the big screen | Click anywhere on it once (browsers need one click) |
| Start completely fresh | Control **Menu → Reset event**: same PIN and QR, everyone joins again |

## Updating

| | |
|---|---|
| Normal | Nothing to do: `start.bat` pulls the latest version every time it starts |
| During an event | **Menu → Check for updates → Update and restart** (laptop corner Menu or control phone; needs the host password). About a minute; the game and the link are kept |
| "Files were changed on this laptop" | Someone edited files here, so the update can't apply cleanly. Copy your changes somewhere, then in the folder: `git stash` (or download a fresh ZIP) |
| No internet | It just uses the version it has |

## Sounds

Short sound effects live in `web/public/sfx/` (`up`, `next`, `land`, `bin`, `whoosh`, `tear`, `drumroll`, `reveal`, `fanfare`, `pop`, `cheer`). Replace any `.mp3` to change it. If a file is missing, a built-in synthesised version plays instead. Phones have a sound on/off button; the big screen's is in its corner Menu. There's no background music track.

## How it looks when people join, then team up

Everyone joins as themselves first (a **Pilot-07** pass), then optionally teams up. From that moment:

| Where | What you see |
|---|---|
| Lobby wall (big screen) | Each person keeps their own name tag, in join order; a team-mate's tag gets the team name under it |
| Player's phone | Their own pass, own throw, own points and place, plus the team card (members, captain, requests) |
| Control phone | "Everyone" lists people (with their team), and **Teams** lists teams with members and waiting requests (both searchable) |
| During a round | Team-mates are called one after another; the big screen shows the whole team in formation |
| Leaderboard, podium, results | One line per person, ranked on their own throw, with "Team Hawks" next to the name. Searching a team name on the results page lists the whole team |
| After the reveal | Every phone gets **📸 Save my result photo**: a ready-to-post picture with their name, place (winners) or "I took part!" with "Finished 12th of 30", their team and their throw |

## Fair play and limits

It's a public event, so the game server protects itself:

| | |
|---|---|
| One pass per person | Each browser keeps a random device key. Joining again from the same browser gives back the same pass, never a second pilot |
| Switching browsers | Each phone also sends a short **hash** of its hardware (screen, cores, memory, graphics chip, time zone). Two passes with the same hash on the same network get a **⚠ same phone as …?** flag on the control phone. It's a hint, not a block: two friends with the same phone model on the same Wi-Fi look alike, so ask before removing anyone |
| Message flood | Every connection has a small allowance of messages that refills each second (players about 2 a second, control phones about 15). Beyond that, taps are dropped with "Give it a second" |
| Join flood | At most 80 new players per network every 5 minutes (high, because a whole class on the campus Wi-Fi shares one address), 300 players per game, 100 teams, and each player can start at most 6 teams |
| Big messages | Anything over 4 KB is ignored |
| Privacy | Internet addresses are stored only as one-way hashes, the hardware hash can't be turned back into details, and nothing about devices is ever sent to players. It all disappears with the game (12 hours) |

The limits are in `LIMITS` at the top of `worker/src/index.ts`.

## Control phones

The host decides who can run the event, and can change it any time (control **Menu → Control phones**, or the laptop's corner **Menu → Control phones**):
- **Host password**: whoever logs in with it is a **host** and can manage the list.
- **Add a control phone**: shows an invite QR. A helper scans it and is in, **no password needed**. Helpers can run the event but can't manage the list.
- **Remove**: that phone is cut off straight away. Removing a helper also replaces the invite link, so their old link can't get them back in. **New invite link** does the same by hand.
- Each phone is remembered by its own key, so a reconnect never needs the password again, and a removed phone stays removed.

## Run it locally (development)

```bash
npm install
```

```bash
npm run dev
```

Worker on port 8787, web app on 5173. Open `http://localhost:5173/host`. For real phones, use the laptop's *Network* address Vite prints (or a phone hotspot).

**Tests.** `tests/server.test.mjs` plays whole games against a local server: every challenge mode, teams and their edge cases, control phones and fair play (about 145 checks). Start a test server, then run the tests:

```bash
npx -w worker wrangler dev --port 8788 --var HOST_PASSWORD:plane-test --persist-to ../.wrangler-test
```

```bash
npm test
```

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
