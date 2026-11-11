import { EVENT } from "./config";

/*
 * "Save my result": draws a portrait photo (1080 x 1350, good for Instagram and phone galleries) of
 * one person's result and hands it to the phone's share sheet, or downloads it where sharing files
 * isn't supported. Drawn on a canvas with the app's own fonts, no extra libraries.
 */

export type ResultPhoto = {
  name: string; // the person
  place?: number; // 1, 2, 3 … only for winners
  tied?: boolean;
  team?: { name: string; members: string[] };
  mine: string; // their own result, e.g. "9.00 m" or "2/3 in the bin"
  teamScore?: string; // e.g. "8.80 m average"
  pin: string;
};

const W = 1080;
const H = 1350;
const NAVY = "#172133";
const BLUE = "#1e3b8f";
const RED = "#d3362c";
const GOLD = "#ffd23f";
const PAPER = "#fbfcf9";

const ord = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Shrinks the font until the text fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, maxW: number) {
  let px = start;
  ctx.font = font(px);
  while (ctx.measureText(text).width > maxW && px > 18) ctx.font = font((px -= 4));
  return px;
}

function plane(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  ctx.translate(-60, -33);
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = NAVY;
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(2, 30);
  ctx.lineTo(118, 4);
  ctx.lineTo(46, 40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#dfe6ea";
  ctx.beginPath();
  ctx.moveTo(46, 40);
  ctx.lineTo(118, 4);
  ctx.lineTo(60, 62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = RED;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(46, 40);
  ctx.lineTo(118, 4);
  ctx.stroke();
  ctx.restore();
}

function airmail(ctx: CanvasRenderingContext2D, y: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y, W, h);
  ctx.clip();
  for (let x = -h; x < W + h; x += 60) {
    ctx.fillStyle = (x / 60) % 2 === 0 ? RED : BLUE;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + 30, y + h);
    ctx.lineTo(x + 30 + h, y);
    ctx.lineTo(x + h, y);
    ctx.fill();
  }
  ctx.restore();
}

export async function drawResult(r: ResultPhoto): Promise<Blob> {
  await document.fonts?.ready;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const display = (px: number) => `${px}px "Bowlby One", Impact, sans-serif`;
  const cond = (px: number, w = 800) => `${w} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const hand = (px: number) => `${px}px "Gochi Hand", "Comic Sans MS", cursive`;
  const winner = !!r.place;

  // sky, like the poster
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#8ec5ee");
  sky.addColorStop(0.55, "#cfe2f6");
  sky.addColorStop(1, "#f3dff0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // soft clouds
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (const [x, y, s] of [
    [120, 1180, 1],
    [930, 1220, 1.2],
    [860, 210, 0.8],
    [160, 260, 0.7],
  ]) {
    for (const [dx, dy, rr] of [
      [0, 0, 90],
      [80, -30, 70],
      [150, 10, 80],
      [-70, 20, 60],
    ])
      ctx.beginPath(), ctx.arc(x + dx * s, y + dy * s, rr * s, 0, Math.PI * 2), ctx.fill();
  }
  airmail(ctx, 0, 34);
  airmail(ctx, H - 34, 34);

  // flight trail + plane
  ctx.strokeStyle = "rgba(30,59,143,0.35)";
  ctx.lineWidth = 6;
  ctx.setLineDash([18, 16]);
  ctx.beginPath();
  ctx.moveTo(-40, 330);
  ctx.bezierCurveTo(260, 140, 560, 330, 860, 150);
  ctx.stroke();
  ctx.setLineDash([]);
  plane(ctx, 880, 140, 1.6, -0.35);

  // heading
  ctx.textAlign = "center";
  ctx.fillStyle = NAVY;
  fit(ctx, EVENT.title.toUpperCase(), display, 78, W - 140);
  ctx.fillText(EVENT.title.toUpperCase(), W / 2, 420);
  ctx.font = cond(36, 700);
  ctx.fillStyle = BLUE;
  ctx.fillText(`${EVENT.hostedBy} · ${EVENT.when}`, W / 2, 472);

  // the card
  const cx = 110;
  const cy = 530;
  const cw = W - 220;
  const ch = 700;
  ctx.save();
  ctx.translate(W / 2, cy + ch / 2);
  ctx.rotate(-0.015);
  ctx.translate(-W / 2, -(cy + ch / 2));
  ctx.fillStyle = "rgba(23,33,51,0.18)";
  ctx.fillRect(cx + 14, cy + 16, cw, ch);
  ctx.fillStyle = PAPER;
  ctx.fillRect(cx, cy, cw, ch);
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 6;
  ctx.strokeRect(cx, cy, cw, ch);
  if (winner) {
    ctx.fillStyle = r.place === 1 ? GOLD : r.place === 2 ? "#e4e8ee" : r.place === 3 ? "#f0c9a0" : "#dbe2f3";
    ctx.fillRect(cx, cy, cw, 150);
    ctx.strokeRect(cx, cy, cw, 150);
  }
  ctx.restore();

  ctx.fillStyle = NAVY;
  if (winner) {
    ctx.font = display(96);
    ctx.fillText(`${r.tied ? "=" : ""}${ord(r.place!)} PLACE`, W / 2, cy + 112);
  } else {
    ctx.font = display(76);
    ctx.fillText("I TOOK PART!", W / 2, cy + 108);
  }

  // name
  fit(ctx, r.name, hand, 130, cw - 80);
  ctx.fillStyle = NAVY;
  ctx.fillText(r.name, W / 2, cy + 300);

  let y = cy + 372;
  if (r.team) {
    ctx.fillStyle = RED;
    fit(ctx, `TEAM ${r.team.name.toUpperCase()}`, (px) => cond(px), 54, cw - 80);
    ctx.fillText(`TEAM ${r.team.name.toUpperCase()}`, W / 2, y);
    y += 50;
    ctx.fillStyle = BLUE;
    const list = r.team.members.join(" · ");
    fit(ctx, list, (px) => cond(px, 600), 38, cw - 80);
    ctx.fillText(list, W / 2, y);
    y += 30;
  }

  // results
  ctx.fillStyle = NAVY;
  ctx.font = cond(44, 700);
  ctx.fillText(r.team ? "MY THROW" : "MY RESULT", W / 2, y + 62);
  ctx.font = display(90);
  fit(ctx, r.mine, display, 90, cw - 260); // leave room for the seal
  ctx.fillText(r.mine, W / 2, y + 148);
  if (r.teamScore) {
    ctx.font = cond(40, 700);
    ctx.fillStyle = BLUE;
    ctx.fillText(`TEAM: ${r.teamScore.toUpperCase()}`, W / 2, y + 205);
  }

  // red seal for winners
  if (winner) {
    ctx.save();
    ctx.translate(cx + cw - 70, cy + ch - 60);
    ctx.rotate(-0.25);
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(0, 0, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PAPER;
    ctx.font = display(44);
    ctx.fillText(ord(r.place!).toUpperCase(), 0, 16);
    ctx.restore();
  }

  ctx.fillStyle = NAVY;
  ctx.font = cond(30, 600);
  ctx.fillText(`Gate ${r.pin} · made with YGYR`, W / 2, H - 62);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"));
}

/** Opens the phone's share sheet (Save Image, Instagram …), or downloads the photo. */
export async function saveResult(r: ResultPhoto) {
  const blob = await drawResult(r);
  const file = new File([blob], `paper-plane-contest-${r.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: EVENT.title });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return "downloaded";
}
