import { useEffect, useRef, useState } from "react";
import { useDialog } from "./Dialog";

/*
 * "Check for updates" for the laptop running start.bat. Talks to the small updater in
 * scripts/start.mjs (proxied at /updater): it pulls the latest code from GitHub, rebuilds and restarts
 * the game + web servers. The public link and the game (players, scores) are kept; screens reconnect.
 */

type Status = {
  git?: boolean;
  reason?: string;
  online?: boolean;
  current?: string;
  date?: string;
  behind?: number;
  changes?: string[];
  dirty?: boolean;
  update: { state: string; message: string; needsRestart?: boolean };
};

const getStatus = (fetchFirst = false) =>
  fetch(`/updater/status${fetchFirst ? "?fetch=1" : ""}`, { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<Status>) : Promise.reject()));

export function UpdatePanel({ password }: { password: string }) {
  const dialog = useDialog();
  const [status, setStatus] = useState<Status | null | "off">(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const poll = useRef<number>();

  const check = () => {
    setStatus(null);
    getStatus(true).then(setStatus, () => setStatus("off"));
  };
  useEffect(() => {
    check();
    return () => clearInterval(poll.current);
  }, []);

  const start = async () => {
    const ok = await dialog.confirm("Update now?", {
      body: "Takes about a minute. The big screen and phones disconnect and reconnect by themselves; players and scores are kept. Best done before the event starts, not mid-round.",
      okLabel: "Update and restart",
    });
    if (!ok) return;
    setBusy(true);
    setNote("Starting the update…");
    const res = await fetch("/updater/update", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }).catch(() => null);
    if (!res || !res.ok) {
      setBusy(false);
      setNote(res?.status === 401 ? "Wrong host password." : "Couldn't start the update.");
      return;
    }
    // The web server goes down for a bit while it rebuilds: keep asking until it's back.
    poll.current = window.setInterval(async () => {
      const s = await getStatus().catch(() => null);
      if (!s) return setNote("Rebuilding… (this page reloads by itself)");
      setNote(s.update.message);
      if (s.update.state === "done") {
        clearInterval(poll.current);
        setTimeout(() => location.reload(), s.update.needsRestart ? 6000 : 1500);
      }
      if (s.update.state === "failed") {
        clearInterval(poll.current);
        setBusy(false);
      }
    }, 2500);
  };

  let body: React.ReactNode;
  if (status === null) body = <p className="hint">Checking GitHub for updates…</p>;
  else if (status === "off") body = <p className="hint">Updates work when the event was started with start.bat on this laptop.</p>;
  else if (!status.git) body = <p className="hint">{status.reason}</p>;
  else
    body = (
      <>
        <p className="hint">
          This version: <b>{status.current}</b> ({status.date})
        </p>
        {!status.online && <p className="hint">Couldn't reach GitHub right now (offline?).</p>}
        {status.dirty && <p className="notice">Files were changed on this laptop, so an update may not apply. start.bat says more.</p>}
        {status.behind ? (
          <>
            <p>
              <b>{status.behind}</b> new update{status.behind > 1 ? "s" : ""} on GitHub:
            </p>
            <ul className="update-list">
              {status.changes?.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <button className="btn red" disabled={busy} onClick={start}>
              {busy ? "Updating…" : "Update and restart"}
            </button>
          </>
        ) : (
          status.online && <p className="hint">Up to date.</p>
        )}
      </>
    );

  return (
    <div className="update-panel">
      {body}
      {note && <p className="notice">{note}</p>}
      {!busy && status !== null && (
        <button className="link" onClick={check}>
          Check again
        </button>
      )}
    </div>
  );
}
