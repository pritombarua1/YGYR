/*
 * Fair play: one pass per person.
 *
 * deviceKey(): a random key this browser keeps (local storage + a cookie, so clearing one isn't enough).
 *   Joining again from the same browser gives back the same pass instead of a second pilot.
 * fingerprint(): a short hash of the phone's hardware as browsers report it (screen, pixel ratio, cores,
 *   memory, touch points, graphics chip, time zone, language), which mostly stays the same in another
 *   browser on the same phone. The server only compares hashes: two passes with the same fingerprint
 *   on the same network are flagged to the host as "maybe the same phone". Not a block, because two
 *   friends with the same phone model can look identical.
 * Nothing readable leaves the phone: only the random key and the hash.
 */

const KEY = "pp:device";

const readCookie = () => document.cookie.split("; ").find((c) => c.startsWith("pp_device="))?.split("=")[1];

export function deviceKey(): string {
  let key = "";
  try {
    key = localStorage.getItem(KEY) ?? "";
  } catch {
    // private mode
  }
  key ||= readCookie() ?? "";
  if (!/^[a-z0-9-]{16,64}$/i.test(key)) key = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  try {
    localStorage.setItem(KEY, key);
  } catch {
    // private mode: the cookie still works
  }
  document.cookie = `pp_device=${key}; max-age=${60 * 60 * 24 * 7}; path=/; SameSite=Lax`;
  return key;
}

/** FNV-1a, twice with different seeds: a stable 16-hex-character hash (no secure context needed). */
function hash(text: string) {
  const one = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return one(2166136261) + one(0x811c9dc5 ^ 0x5bd1e995);
}

function gpu() {
  try {
    const gl = document.createElement("canvas").getContext("webgl") as WebGLRenderingContext | null;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return (ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : gl?.getParameter(gl.RENDERER)) ?? "";
  } catch {
    return "";
  }
}

export function fingerprint(): string {
  const n = navigator as Navigator & { deviceMemory?: number };
  const parts = [
    Math.min(screen.width, screen.height),
    Math.max(screen.width, screen.height),
    window.devicePixelRatio,
    screen.colorDepth,
    n.hardwareConcurrency ?? "",
    n.deviceMemory ?? "",
    n.maxTouchPoints ?? "",
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    (n.language || "").split("-")[0],
    gpu(),
  ];
  return hash(parts.join("|"));
}
