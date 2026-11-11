import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api (including WebSockets) goes to the Worker on port 8787.
// `vite preview` reuses this proxy, which is how start.bat serves the event.
const proxy = { "/api": { target: `http://127.0.0.1:${process.env.API_PORT ?? 8787}`, ws: true } };
// Lets the free Cloudflare quick tunnel (https://xxxx.trycloudflare.com) reach the server.
const allowedHosts = [".trycloudflare.com"];

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy, allowedHosts },
  // Not Vite's default 4173: Windows often reserves the 4101-4200 range for Hyper-V.
  preview: { port: 5180, proxy, allowedHosts },
});
