import { useState } from "react";
import type { GameState } from "../types";
import { useQr } from "../pages/Host";
import { useDialog } from "./Dialog";

/*
 * Who can run the event. The host adds control phones any time with the invite QR (no password
 * needed: helpers can run the event but not manage the list), sees who's connected, renames and
 * removes them. "New invite link" makes old links stop working; phones already in stay in.
 */
export function Controllers({ state, send, me, admin }: { state: GameState; send: (m: object) => void; me?: string; admin: boolean }) {
  const dialog = useDialog();
  const [showQr, setShowQr] = useState(false);
  const link = state.invite ? `${location.origin}/control?pin=${state.pin}&invite=${state.invite}` : "";
  const qr = useQr(link || location.origin);

  return (
    <div className="controllers">
      <ul className="ctrl-list">
        {state.ctrl.length === 0 && <li className="hint">No control phones yet.</li>}
        {state.ctrl.map((c) => (
          <li key={c.id}>
            <span className={`ctrl-dot ${c.online ? "on" : ""}`} aria-label={c.online ? "connected" : "not connected"} />
            <span className="ctrl-name">
              {c.name}
              {c.id === me && " (this phone)"}
              <small>{c.admin ? "host" : "helper"}</small>
            </span>
            {admin && c.id !== me && (
              <button
                className="link danger"
                onClick={async () => {
                  const ok = await dialog.confirm(`Remove ${c.name}?`, {
                    body: c.admin
                      ? "That phone stops controlling straight away (it can log in again with the host password)."
                      : "That phone stops controlling straight away, and the invite link is replaced so it can't come back in. Other phones already in stay in.",
                    okLabel: "Remove",
                    danger: true,
                  });
                  if (ok) send({ t: "controllerRemove", id: c.id });
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {admin && link && (
        <>
          <button className="btn" onClick={() => setShowQr((v) => !v)}>
            {showQr ? "Hide invite QR" : "Add a control phone"}
          </button>
          {showQr && (
            <div className="ctrl-invite">
              <div className="ctrl-qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="hint">
                Scan on the helper's phone (or open <b>{link.replace(/^https?:\/\//, "")}</b>). No password needed: helpers run the event, only you manage this
                list.
              </p>
              <button
                className="link"
                onClick={async () => {
                  const ok = await dialog.confirm("Make a new invite link?", {
                    body: "The old link and QR stop working. Phones that are already in stay in.",
                    okLabel: "New link",
                  });
                  if (ok) send({ t: "newInvite" });
                }}
              >
                New invite link (old one stops working)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
