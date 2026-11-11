import { Fragment } from "react";
import readme from "../../../README.md?raw";

/*
 * The project README, readable on a phone (control phone → Guide, or /guide).
 * A small Markdown reader for what the README uses: headings, paragraphs, lists,
 * tables, code blocks, **bold**, `code`, *italic* and [links](url).
 */

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <b key={i}>{part.slice(2, -2)}</b>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = link[2];
      // links to other repo files (TESTING.md) aren't pages in the app: show them as text
      return /^https?:/.test(href) ? (
        <a key={i} href={href} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      ) : (
        <b key={i}>{link[1]}</b>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const out: JSX.Element[] = [];
  let i = 0;
  const key = () => `b${out.length}`;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      out.push(
        <pre key={key()}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      const Tag = (["h1", "h2", "h3"] as const)[h[1].length - 1];
      out.push(<Tag key={key()}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{3,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <div className="md-table" key={key()}>
          <table>
            <thead>
              <tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, k) => (
                <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^(\s*)(-|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^(\s*)(-|\d+\.)\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*(-|\d+\.)\s/, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      out.push(
        <List key={key()}>
          {items.map((t, j) => (
            <li key={j}>{inline(t)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||```|\s*(-|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    out.push(<p key={key()}>{inline(para.join(" "))}</p>);
  }
  return <div className="md">{out}</div>;
}

/** Full-screen README sheet (from the control phone). */
export function ReadmeSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="readme-sheet">
      <header className="control-head">
        <strong>Guide (README)</strong>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </header>
      <main className="phone-main">
        <Markdown source={readme} />
      </main>
    </div>
  );
}

/** /guide: the same README as its own page. */
export default function ReadmePage() {
  return (
    <div className="phone">
      <div className="airmail" />
      <main className="phone-main">
        <Markdown source={readme} />
      </main>
    </div>
  );
}
