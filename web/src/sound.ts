import { useEffect, useState } from "react";

/*
 * Sound effects. Each one plays web/public/sfx/<name>.mp3 when present,
 * and falls back to a small synthesised version, so there is never silence if a file is missing.
 * Browsers only allow sound after a tap or click, so the first tap anywhere switches audio on.
 */

export type Sfx = "up" | "next" | "land" | "bin" | "whoosh" | "tear" | "drumroll" | "reveal" | "fanfare" | "pop" | "cheer";
const ALL: Sfx[] = ["up", "next", "land", "bin", "whoosh", "tear", "drumroll", "reveal", "fanfare", "pop", "cheer"];

let ctx: AudioContext | null = null;
const files = new Map<Sfx, AudioBuffer | null>();
const listeners = new Set<() => void>();
const KEY = "pp:sound";

const readOn = () => {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
};
let on = readOn();

export const soundReady = () => !!ctx && ctx.state === "running";
const notify = () => listeners.forEach((f) => f());

/** Call from any tap/click. Creates the audio engine and starts loading the sound files. */
export function unlockSound() {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      for (const name of ALL) {
        fetch(`/sfx/${name}.mp3`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
          .then((b) => ctx!.decodeAudioData(b))
          .then((buf) => files.set(name, buf))
          .catch(() => files.set(name, null));
      }
    }
    if (ctx.state !== "running") ctx.resume().then(notify, notify);
    notify();
  } catch {
    // no audio on this device; the app still works silently
  }
}

export function setSoundOn(value: boolean) {
  on = value;
  try {
    localStorage.setItem(KEY, value ? "on" : "off");
  } catch {
    // ignore
  }
  if (value) unlockSound();
  notify();
}

/** [sound switched on?, audio actually running?, toggle] */
export function useSound() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => void listeners.delete(f);
  }, []);
  return [on, soundReady(), () => setSoundOn(!on)] as const;
}

// How long each sound may play (seconds). The generated files vary in length; the bin one runs 10 s.
// The drumroll file is short, so it loops for the whole suspense.
const SHAPE: Partial<Record<Sfx, { max?: number; loopFor?: number }>> = {
  bin: { max: 1.4 },
  next: { max: 1.5 },
  land: { max: 2 },
  cheer: { max: 3 },
  drumroll: { loopFor: 2.5 },
};

export function play(name: Sfx, volume = 1) {
  if (!on || !ctx || ctx.state !== "running" || document.visibilityState === "hidden") return;
  const buf = files.get(name);
  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(ctx.destination);
  if (!buf) return synth(name, ctx, out);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(out);
  const shape = SHAPE[name];
  const length = shape?.loopFor ?? Math.min(buf.duration, shape?.max ?? buf.duration);
  if (shape?.loopFor) src.loop = true;
  const t = ctx.currentTime;
  // short fade at the end so cut-off sounds don't click
  out.gain.setValueAtTime(volume, t + Math.max(0, length - 0.15));
  out.gain.linearRampToValueAtTime(0.0001, t + length);
  src.start(t);
  src.stop(t + length + 0.02);
  if (name === "fanfare") play("cheer", volume * 0.7); // the 1st-place moment gets the crowd too
}

/* ---------- synthesised fallbacks (tiny, no files) ---------- */

function tone(c: AudioContext, out: AudioNode, freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.3) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(out);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

function noise(c: AudioContext, out: AudioNode, start: number, dur: number, from: number, to: number, gain = 0.25) {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(from, c.currentTime + start);
  f.frequency.exponentialRampToValueAtTime(to, c.currentTime + start + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  src.connect(f).connect(g).connect(out);
  src.start(c.currentTime + start);
}

function synth(name: Sfx, c: AudioContext, out: AudioNode) {
  switch (name) {
    case "up":
      tone(c, out, 784, 0, 0.25, "triangle");
      tone(c, out, 1175, 0.14, 0.45, "triangle");
      break;
    case "next":
      tone(c, out, 988, 0, 0.6, "sine", 0.2);
      break;
    case "land":
      noise(c, out, 0, 0.5, 600, 3000, 0.15);
      tone(c, out, 1319, 0.45, 0.4, "sine", 0.2);
      break;
    case "bin":
      noise(c, out, 0, 0.12, 2000, 800, 0.3);
      tone(c, out, 220, 0.08, 0.25, "square", 0.08);
      break;
    case "whoosh":
      noise(c, out, 0, 0.7, 300, 4000, 0.3);
      break;
    case "tear":
      noise(c, out, 0, 0.35, 3000, 6000, 0.25);
      break;
    case "drumroll":
      for (let i = 0; i < 28; i++) tone(c, out, 90 + (i % 2) * 8, i * 0.1, 0.12, "triangle", 0.08 + i * 0.008);
      break;
    case "reveal":
      tone(c, out, 70, 0, 0.6, "sine", 0.6);
      noise(c, out, 0.02, 1.4, 5000, 9000, 0.12);
      break;
    case "fanfare":
      [523, 659, 784, 1047].forEach((f, i) => tone(c, out, f, i * 0.12, 0.5, "sawtooth", 0.08));
      [523, 659, 784].forEach((f) => tone(c, out, f, 0.55, 1.2, "sawtooth", 0.07));
      break;
    case "pop":
      tone(c, out, 660, 0, 0.08, "sine", 0.2);
      break;
    case "cheer":
      noise(c, out, 0, 1.6, 1200, 2500, 0.2);
      break;
  }
}
