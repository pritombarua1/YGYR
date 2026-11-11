import { createContext, useContext, useMemo, useState } from "react";
import { motion } from "motion/react";

// In-app replacements for window.confirm / window.prompt, styled like the rest of the app.

type Opts = { body?: string; okLabel?: string; danger?: boolean; secret?: boolean };
type Request = Opts & { kind: "confirm" | "prompt"; title: string; resolve: (v: boolean | string | null) => void };

interface DialogApi {
  confirm(title: string, opts?: Opts): Promise<boolean>;
  prompt(title: string, initial?: string, opts?: Opts): Promise<string | null>;
}

const Ctx = createContext<DialogApi | null>(null);

export const useDialog = () => useContext(Ctx)!;

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);
  const [value, setValue] = useState("");

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (title, opts = {}) =>
        new Promise((resolve) => setReq({ ...opts, kind: "confirm", title, resolve: resolve as Request["resolve"] })),
      prompt: (title, initial = "", opts = {}) =>
        new Promise((resolve) => {
          setValue(initial);
          setReq({ ...opts, kind: "prompt", title, resolve: resolve as Request["resolve"] });
        }),
    }),
    [],
  );

  const close = (ok: boolean) => {
    if (!req) return;
    req.resolve(req.kind === "confirm" ? ok : ok ? value.trim() || null : null);
    setReq(null);
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* No exit animation on purpose: it closes instantly, so it can never be left covering the screen. */}
      {req && (
          <motion.div
            className="dialog-back"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            onClick={() => close(false)}
          >
            <motion.form
              className="dialog sheet taped"
              role="dialog"
              aria-modal="true"
              aria-label={req.title}
              initial={{ y: 40, rotate: -4 }}
              animate={{ y: 0, rotate: -1 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === "Escape" && close(false)}
              onSubmit={(e) => {
                e.preventDefault();
                close(true);
              }}
            >
              <h2 className="display">{req.title}</h2>
              {req.body && <p>{req.body}</p>}
              {req.kind === "prompt" && (
                <input
                  autoFocus
                  type={req.secret ? "password" : "text"}
                  maxLength={req.secret ? 100 : 20}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
              <div className="dialog-actions">
                <button type="button" className="btn" onClick={() => close(false)}>
                  Cancel
                </button>
                <button className={`btn ${req.danger ? "red" : "navy"}`} autoFocus={req.kind === "confirm"}>
                  {req.okLabel ?? "OK"}
                </button>
              </div>
            </motion.form>
          </motion.div>
      )}
    </Ctx.Provider>
  );
}
