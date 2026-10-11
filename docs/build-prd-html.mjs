// Builds docs/PRD.html, a styled and navigable version of docs/PRD.md.
// No dependencies: a small Markdown reader for the syntax the PRD uses
// (headings, paragraphs, tables, nested lists, quotes, mermaid diagrams).
// Usage: node docs/build-prd-html.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DOCS = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(DOCS, "PRD.md");
const OUTPUT = path.join(DOCS, "PRD.html");

// ---------- Markdown blocks ----------

const LIST_ITEM = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const isFence = (l) => /^```/.test(l);
const isHeading = (l) => /^#{1,6}\s/.test(l);
const isRule = (l) => /^-{3,}\s*$/.test(l);
const isQuote = (l) => /^>/.test(l);
const isTableRow = (l) => /^\|/.test(l);
const isListItem = (l) => LIST_ITEM.test(l);

function splitRow(line) {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cell = "";
  let inCode = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "`") inCode = !inCode;
    if (ch === "\\" && body[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (ch === "|" && !inCode) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function parseList(lines) {
  const newList = (marker, indent) => ({ type: "list", ordered: /\d/.test(marker), start: parseInt(marker, 10) || 1, indent, items: [] });
  const [, firstLead, firstMarker] = lines[0].match(LIST_ITEM);
  const root = newList(firstMarker, firstLead.length);
  const stack = [root];
  for (const line of lines) {
    const [, lead, marker, text] = line.match(LIST_ITEM);
    while (stack.length > 1 && lead.length < stack.at(-1).indent) stack.pop();
    let list = stack.at(-1);
    if (lead.length > list.indent && list.items.length) {
      const sub = newList(marker, lead.length);
      list.items.at(-1).sub = sub;
      stack.push(sub);
      list = sub;
    }
    list.items.push({ text });
  }
  return root;
}

function parseBlocks(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || isRule(line)) {
      i++;
    } else if (isFence(line)) {
      const lang = line.slice(3).trim();
      const body = [];
      for (i++; i < lines.length && !isFence(lines[i]); i++) body.push(lines[i]);
      i++;
      blocks.push({ type: "code", lang, text: body.join("\n") });
    } else if (isHeading(line)) {
      const [, hashes, text] = line.match(/^(#{1,6})\s+(.*)$/);
      blocks.push({ type: "heading", level: hashes.length, text: text.trim() });
      i++;
    } else if (isQuote(line)) {
      const body = [];
      while (i < lines.length && isQuote(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push({ type: "quote", text: body.join(" ").trim() });
    } else if (isTableRow(line) && /^\|?\s*:?-{3,}/.test(lines[i + 1] ?? "")) {
      const header = splitRow(line);
      const rows = [];
      for (i += 2; i < lines.length && isTableRow(lines[i]); i++) rows.push(splitRow(lines[i]));
      blocks.push({ type: "table", header, rows });
    } else if (isListItem(line)) {
      const items = [];
      while (i < lines.length && isListItem(lines[i])) items.push(lines[i++]);
      blocks.push(parseList(items));
    } else {
      const body = [];
      const startsBlock = (l) => !l.trim() || isFence(l) || isHeading(l) || isRule(l) || isQuote(l) || isTableRow(l) || isListItem(l);
      while (i < lines.length && (body.length === 0 || !startsBlock(lines[i]))) body.push(lines[i++].trim());
      blocks.push({ type: "para", text: body.join(" ") });
    }
  }
  return blocks;
}

// ---------- Document structure ----------

const plain = (s) => s.replace(/\*\*|`|~~/g, "").trim();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function headingParts(text) {
  const m = text.match(/^(\d+(?:\.\d+)*)\.?\s+(.*)$/);
  return m ? { num: m[1], title: m[2] } : { num: null, title: text };
}

const usedIds = new Set();
function uniqueId(base) {
  let id = base;
  for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
  usedIds.add(id);
  return id;
}
const headingId = ({ num, title }) => uniqueId(num ? `sec-${num.replace(/\./g, "-")}` : slug(title));

const markdown = readFileSync(SOURCE, "utf8");
const blocks = parseBlocks(markdown);
const titleBlock = blocks.find((b) => b.type === "heading" && b.level === 1);
const preamble = [];
const sections = [];
for (const b of blocks) {
  if (b === titleBlock) continue;
  if (b.type === "heading" && b.level === 2) {
    const parts = headingParts(b.text);
    sections.push({ ...parts, id: headingId(parts), blocks: [], subs: [] });
  } else if (!sections.length) {
    preamble.push(b);
  } else {
    const section = sections.at(-1);
    if (b.type === "heading") {
      b.parts = headingParts(b.text);
      b.id = headingId(b.parts);
      if (b.level === 3) section.subs.push(b);
    }
    section.blocks.push(b);
  }
}

// Anchors, open-question status and counts, gathered before rendering so
// cross-references only link to things that exist.
const PARTIAL_LABELS = { direction: "Direction set", estimate: "Estimate" };
const anchors = new Set(usedIds);
const questions = [];
const decided = new Map();
const counts = { stories: 0, fr: 0, nfr: 0, hazards: 0, sources: 0 };
for (const section of sections) {
  let sub = null;
  for (const b of section.blocks) {
    if (b.type === "heading") sub = b.parts.num;
    b.sub = sub;
    if (b.type === "para" && /^\*\*US-\d+/.test(b.text)) counts.stories++;
    if (b.type === "list" && section.num === "20") {
      for (const item of b.items) {
        const s = item.text.match(/^\[S(\d+)\]/);
        if (s) {
          anchors.add(`s${s[1]}`);
          counts.sources++;
        }
      }
    }
    if (b.type !== "table") continue;
    b.rows.forEach((row, n) => {
      const id = plain(row[0] ?? "");
      if (/^FR-\d+$/.test(id)) counts.fr++;
      if (/^NFR-\d+$/.test(id)) counts.nfr++;
      if (/^N?FR-\d+$/.test(id)) row.anchor = id.toLowerCase();
      if (section.num === "12" && /^H\d+$/.test(id)) counts.hazards++;
      if (sub === "17.4" && /^Q\d+$/.test(id)) {
        row.anchor = id.toLowerCase();
        questions.push(id);
      }
      if (sub === "17.5") {
        row.anchor = `decision-${n + 1}`;
        // "Q25 (direction)" or "Q29 (estimate)" settles a question only partly.
        const qualifier = row[0].match(/\((direction|estimate)\)/i)?.[1].toLowerCase();
        const partial = qualifier ? PARTIAL_LABELS[qualifier] : null;
        for (const q of row[0].match(/Q\d+/g) ?? []) {
          const prev = decided.get(q);
          if (!prev || (prev.partial && !partial)) decided.set(q, { href: `#${row.anchor}`, partial });
        }
      }
      if (row.anchor) anchors.add(row.anchor);
    });
  }
}
const questionCounts = { decided: 0, partial: 0, open: 0 };
for (const q of questions) {
  const d = decided.get(q);
  questionCounts[!d ? "open" : d.partial ? "partial" : "decided"]++;
}

// ---------- Inline text ----------

const tag = (kind, text) => `<span class="tag tag-${kind}">${text}</span>`;

function labels(html) {
  return html
    .replace(/<strong>\((proposed additions?)\)<\/strong>/gi, (_, t) => tag("proposed", t))
    .replace(/<em>Proposed:<\/em>/g, tag("proposed", "Proposed"))
    .replace(/^Proposed:\s*/, `${tag("proposed", "Proposed")} `)
    .replace(/\(Proposed\)/g, tag("proposed", "Proposed"))
    .replace(/^<strong>([A-Z]\d+)\.<\/strong>/, (_, id) => `<span class="id">${id}</span>`)
    .replace(/<strong>(US-\d+) /, (_, id) => `<strong><span class="id">${id}</span> `);
}

// Links §7.2, FR-5, NFR-1 and Q17 to their place in the document, outside existing links.
function crossLinks(html) {
  const link = (text, id) => (anchors.has(id) ? `<a class="xref" href="#${id}">${text}</a>` : text);
  let inLink = 0;
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith("<")) {
        if (/^<a[\s>]/.test(part)) inLink++;
        else if (part === "</a>") inLink--;
        return part;
      }
      if (inLink) return part;
      return part
        .replace(/§(\d+(?:\.\d+)?)/g, (m, n) => link(m, `sec-${n.replace(/\./g, "-")}`))
        .replace(/\bN?FR-\d+\b/g, (m) => link(m, m.toLowerCase()))
        .replace(/\bQ\d{1,2}\b/g, (m) => link(m, m.toLowerCase()));
    })
    .join("");
}

function inline(src) {
  const codes = [];
  let s = src.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0001`);
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
  s = s.replace(/\[([^\]]+)\]\(([\w./-]+\.html(?:#[\w-]+)?)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
  s = s.replace(/\[S#\]/g, '<span class="cite">S#</span>');
  s = s.replace(/\[S(\d+)\]/g, (_, n) => `<a class="cite" href="#s${n}">S${n}</a>`);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])/g, "$1<em>$2</em>");
  s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]*[^\s<.,;:)])/g, (_, pre, u) => `${pre}<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  s = crossLinks(labels(s));
  return s.replace(/\u0000(\d+)\u0001/g, (_, n) => `<code>${esc(codes[n])}</code>`);
}

// ---------- Blocks to HTML ----------

const ICON = {
  yes: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  no: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

// Small glyphs from a lab report: the flag column, the printed range, a GP's threshold.
const TRIGGER_GLYPH = {
  flag: '<span class="g-flag">H</span>',
  range:
    '<svg class="g-range" viewBox="0 0 120 28"><line x1="6" y1="14" x2="114" y2="14" class="rg-track"/><line x1="30" y1="14" x2="78" y2="14" class="rg-band"/><line x1="30" y1="7" x2="30" y2="21" class="rg-tick"/><line x1="78" y1="7" x2="78" y2="21" class="rg-tick"/><circle cx="98" cy="14" r="5" class="rg-dot"/></svg>',
  rule: '<span class="g-rule">&gt; X</span>',
};

const CELL_LABELS = {
  Requirement: tag("req", "Requirement"),
  Target: tag("target", "Target"),
  Proposed: tag("proposed", "Proposed"),
  Decision: tag("decision", "Decision"),
  "Assumption (A#)": `${tag("assumption", "Assumption")} <span class="id">A#</span>`,
  "Hypothesis (H#)": `${tag("hypothesis", "Hypothesis")} <span class="id">H#</span>`,
  "[S#]": '<span class="cite">S#</span>',
  "Q#": '<span class="id">Q#</span>',
};

const cellHtml = (cell) => CELL_LABELS[plain(cell)] ?? inline(cell);
const idCell = (cell) => (/^(N?FR|US)-\d+$|^[HQADP]\d+$/.test(plain(cell)) ? `<span class="id">${esc(plain(cell))}</span>` : null);

function questionStatus(q) {
  const d = decided.get(q);
  if (!d) return tag("open", "Open");
  return `<a class="tag tag-${d.partial ? "proposed" : "decision"}" href="${d.href}">${d.partial ?? "Decided"}</a>`;
}

function renderKeep(table) {
  const column = (c, kind) => {
    const items = table.rows.map((r) => r[c]).filter((x) => x?.trim());
    return `<div class="keep-col keep-${kind}"><p class="keep-title">${inline(table.header[c])}</p><ul>${items
      .map((x) => `<li>${ICON[kind]}<span>${inline(x)}</span></li>`)
      .join("")}</ul></div>`;
  };
  return `<div class="keep">${column(0, "yes")}${column(1, "no")}</div>`;
}

function renderTable(table, section) {
  const head = table.header.map(plain);
  if (section.num === "1" && head[0] === "Field") return ""; // shown in the page header
  if (head[0] === "Store" && /^don.t store$/i.test(head[1])) return renderKeep(table);
  const isQuestions = table.sub === "17.4" && head[0] === "#";
  const headers = isQuestions ? [...table.header, "Status"] : table.header;
  const rows = table.rows.map((row) => {
    const cells = row.map((cell, c) => `<td>${(c === 0 && idCell(cell)) || cellHtml(cell)}</td>`);
    if (isQuestions) cells.push(`<td>${questionStatus(plain(row[0]))}</td>`);
    return `<tr${row.anchor ? ` id="${row.anchor}"` : ""}>${cells.join("")}</tr>`;
  });
  return `<div class="table-wrap"><table${headers.length >= 4 ? ' class="wide"' : ""}><thead><tr>${headers
    .map((h) => `<th scope="col">${inline(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function renderList(list, section) {
  const name = list.ordered ? "ol" : "ul";
  const start = list.ordered && list.start !== 1 ? ` start="${list.start}"` : "";
  const isSources = section.num === "20";
  const items = list.items.map((item) => {
    const source = isSources && item.text.match(/^\[S(\d+)\]\s*(.*)$/);
    if (source) return `<li id="s${source[1]}"><span class="cite">S${source[1]}</span> <span>${inline(source[2])}</span></li>`;
    return `<li>${inline(item.text)}${item.sub ? renderList(item.sub, section) : ""}</li>`;
  });
  return `<${name}${start}${isSources ? ' class="sources"' : ""}>${items.join("")}</${name}>`;
}

function renderTriggers(list) {
  const cards = list.items.map((item) => {
    const kind = /flag/i.test(item.text) ? "flag" : /range/i.test(item.text) ? "range" : /rule/i.test(item.text) ? "rule" : null;
    return `<li class="trigger"><div class="trigger-glyph" aria-hidden="true">${kind ? TRIGGER_GLYPH[kind] : ""}</div><p>${inline(item.text)}</p></li>`;
  });
  return `<ol class="triggers">${cards.join("")}</ol>`;
}

function renderQuote(text) {
  if (/^["“]/.test(text)) return `<blockquote class="pull">${inline(text)}</blockquote>`;
  const label = text.match(/^\*{1,2}([^*]+?)\*{1,2}/)?.[1] ?? "";
  const kind = /implemented/i.test(label) ? "done" : /draft/i.test(label) ? "draft" : "caution";
  return `<aside class="callout callout-${kind}">${inline(text)}</aside>`;
}

function renderBlock(b, prev, section) {
  switch (b.type) {
    case "heading": {
      const num = b.parts.num ? `<span class="num">${b.parts.num}</span>` : "";
      return `<h${b.level} id="${b.id}">${num}<span>${inline(b.parts.title)}</span></h${b.level}>`;
    }
    case "para": {
      const group = b.text.match(/^\*\*([^*]+)\*\*$/);
      return group ? `<p class="group">${inline(group[1])}</p>` : `<p>${inline(b.text)}</p>`;
    }
    case "quote":
      return renderQuote(b.text);
    case "code":
      return b.lang === "mermaid"
        ? `<figure class="diagram"><pre class="mermaid">${esc(b.text)}</pre></figure>`
        : `<pre class="code"><code>${esc(b.text)}</code></pre>`;
    case "list":
      return prev?.type === "para" && /three things:$/.test(prev.text) && b.items.length === 3 ? renderTriggers(b) : renderList(b, section);
    case "table":
      return renderTable(b, section);
    default:
      return "";
  }
}

const renderBlocks = (section) => section.blocks.map((b, i) => renderBlock(b, section.blocks[i - 1], section)).join("\n");

// ---------- Page ----------

const [productName, documentName = "Product Requirements Document"] = titleBlock.text.split(/\s+—\s+/);
const infoTable = sections.find((s) => s.num === "1")?.blocks.find((b) => b.type === "table");
const info = Object.fromEntries((infoTable?.rows ?? []).map(([k, v]) => [plain(k), v]));
const lede = sections.find((s) => s.num === "2")?.blocks.find((b) => b.type === "para")?.text ?? "";
const notice = preamble.find((b) => b.type === "quote");

const meta = ["Version", "Date", "Status", "Owners", "Audience", "Covers"]
  .filter((k) => info[k])
  .map((k) => `<div><dt>${k}</dt><dd>${k === "Status" ? tag("open", esc(plain(info[k]))) : inline(info[k])}</dd></div>`)
  .join("");

const pct = (n) => (questions.length ? ((n / questions.length) * 100).toFixed(1) : 0);
const stat = (href, n, label) => (n ? `<li><a href="#${href}"><b>${n}</b><span>${label}</span></a></li>` : "");
const stats = [
  stat("sec-6", counts.stories, "user stories"),
  stat("sec-7", counts.fr, "functional requirements"),
  stat("sec-8", counts.nfr, "non-functional requirements"),
  stat("sec-12-1", counts.hazards, "clinical hazards"),
  stat("sec-20", counts.sources, "sources"),
  questions.length
    ? `<li class="stat-questions"><a href="#sec-17-4"><b>${questions.length}</b><span>open questions logged: ${questionCounts.decided} decided, ${questionCounts.partial} partly settled, ${questionCounts.open} still open</span><span class="bar" aria-hidden="true"><i class="bar-decided" style="width:${pct(questionCounts.decided)}%"></i><i class="bar-direction" style="width:${pct(questionCounts.partial)}%"></i><i class="bar-open" style="width:${pct(questionCounts.open)}%"></i></span></a></li>`
    : "",
].join("");

const tocItem = (s) => {
  const subs = s.subs.length
    ? `<ol>${s.subs.map((h) => `<li><a href="#${h.id}"><span class="n">${h.parts.num ?? ""}</span><span>${inline(h.parts.title)}</span></a></li>`).join("")}</ol>`
    : "";
  return `<li data-target="${s.id}"><a href="#${s.id}"><span class="n">${s.num ?? ""}</span><span>${inline(s.title)}</span></a>${subs}</li>`;
};
const toc = sections.map(tocItem).join("");
const tocShort = sections.map((s) => `<li><a href="#${s.id}"><span class="n">${s.num ?? ""}</span><span>${inline(s.title)}</span></a></li>`).join("");

const body = sections
  .map((s) => `<section class="doc-section" id="${s.id}"><h2><span class="num">§${s.num ?? ""}</span><span>${inline(s.title)}</span></h2>\n${renderBlocks(s)}</section>`)
  .join("\n");

const LOGO =
  '<svg class="logo" viewBox="0 4 35 34.5" aria-hidden="true"><rect x="0" y="10.5" width="3" height="10.5" class="logo-bar"/><rect x="4" y="7" width="3" height="18.5" class="logo-bar"/><rect x="8" y="4" width="3" height="27" class="logo-bar"/><rect x="12" y="5.5" width="3" height="30" class="logo-bar"/><rect x="16" y="9" width="3" height="29.5" class="logo-bar"/><rect x="20" y="5.5" width="3" height="30" class="logo-bar"/><rect x="24" y="4" width="3" height="27" class="logo-accent"/><rect x="28" y="7" width="3" height="18.5" class="logo-bar"/><rect x="32" y="10.5" width="3" height="10.5" class="logo-bar"/></svg>';

const built = new Date().toISOString().slice(0, 10);

const page = `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>BloodLine PRD</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Geist+Mono:wght@400;500&family=Urbanist:ital,wght@0,500;0,600;0,700;1,500&display=swap">
<style>
/* Layout: a sticky contents rail beside one document sheet. Prose keeps a reading
   width; tables and diagrams may use the sheet's full width and scroll inside it. */
:root {
  --bg: #f1f4f6;
  --surface: #ffffff;
  --ink: #123441;
  --muted: #556c77;
  --line: #dde6ea;
  --line-strong: #c3d1d7;
  --brand: #0f3b4b;
  --brand-soft: #d7e9ef;
  --link: #0b6a78;
  --amber: #7a5212;
  --amber-soft: #fbf0dc;
  --amber-line: #d99a35;
  --green: #1f6e4d;
  --green-soft: #e1f1ea;
  --red: #a3392f;
  --font-display: "Urbanist", "Segoe UI", system-ui, sans-serif;
  --font-body: "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, "Cascadia Mono", Consolas, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0c171c; --surface: #112129; --ink: #e1ebef; --muted: #93a8b2; --line: #20363f; --line-strong: #2e4a55;
    --brand: #a3d6e4; --brand-soft: #173944; --link: #7fcbd8; --amber: #f0c27e; --amber-soft: #33270f; --amber-line: #b8822e;
    --green: #7fd3ad; --green-soft: #10302a; --red: #f19a92; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #0c171c; --surface: #112129; --ink: #e1ebef; --muted: #93a8b2; --line: #20363f; --line-strong: #2e4a55;
  --brand: #a3d6e4; --brand-soft: #173944; --link: #7fcbd8; --amber: #f0c27e; --amber-soft: #33270f; --amber-line: #b8822e;
  --green: #7fd3ad; --green-soft: #10302a; --red: #f19a92; color-scheme: dark;
}

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
body { margin: 0; background: var(--bg); color: var(--ink); font: 400 1.0625rem/1.65 var(--font-body); }
[id] { scroll-margin-top: 1.5rem; }
a { color: var(--link); text-underline-offset: 0.18em; text-decoration-thickness: 1px; }
a:focus-visible, summary:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; border-radius: 4px; }
code { font: 0.86em/1.4 var(--font-mono); background: var(--bg); border: 1px solid var(--line); border-radius: 5px; padding: 0.05em 0.35em; overflow-wrap: anywhere; }
del { color: var(--muted); }
.skip { position: absolute; left: -999px; top: 0; }
.skip:focus { left: 1rem; top: 1rem; z-index: 10; background: var(--surface); padding: 0.5rem 0.75rem; border-radius: 8px; }

.shell { display: grid; grid-template-columns: 15.5rem minmax(0, 1fr); gap: 2.5rem; max-width: 78rem; margin: 0 auto; padding-inline: clamp(1rem, 3vw, 2rem); padding-block: 2rem 5rem; }

/* Contents rail */
.rail nav { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 1.5rem); max-height: calc(100vh - 3rem); overflow-y: auto; padding-right: 0.25rem; }
.rail-head { display: flex; align-items: center; gap: 0.6rem; margin: 0 0 1.25rem 0.5rem; font: 700 1.0625rem/1 var(--font-display); color: var(--ink); text-decoration: none; }
.rail-head .logo { width: 1.75rem; height: 1.75rem; }
.toc, .toc ol { list-style: none; margin: 0; padding: 0; }
.toc a { display: grid; grid-template-columns: 2.1rem minmax(0, 1fr); gap: 0.25rem; padding: 0.32rem 0.5rem; border-radius: 8px; color: var(--muted); text-decoration: none; font: 500 0.875rem/1.35 var(--font-display); }
.toc a:hover { color: var(--ink); background: var(--surface); }
.toc .n { font: 500 0.75rem/1.6 var(--font-mono); font-variant-numeric: tabular-nums; }
.toc li.is-active > a { color: var(--ink); background: var(--surface); box-shadow: inset 0 0 0 1px var(--line); }
.rail .toc li > ol { display: none; margin: 0.15rem 0 0.4rem; }
.rail .toc li.is-active > ol { display: block; }
.rail .toc ol a { grid-template-columns: 2.4rem minmax(0, 1fr); padding-left: 1.5rem; font-size: 0.8125rem; }
.toc-mobile { display: none; }

/* Document sheet */
.sheet { min-width: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: clamp(1.25rem, 4vw, 3.5rem); }
.doc-head { display: flex; flex-direction: column; gap: 1.5rem; padding-bottom: 2.5rem; margin-bottom: 3rem; border-bottom: 1px solid var(--line); }
.brand { display: flex; align-items: center; gap: 0.9rem; }
.brand .logo { width: 3rem; height: 3rem; flex: none; }
.eyebrow { margin: 0 0 0.35rem; font: 700 0.75rem/1.2 var(--font-display); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
h1 { margin: 0; font: 700 clamp(2.4rem, 6vw, 3.4rem)/1 var(--font-display); letter-spacing: -0.02em; color: var(--brand); }
.lede { margin: 0; max-width: 54ch; font-size: 1.1875rem; line-height: 1.55; }
.meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr)); gap: 1rem 1.75rem; margin: 0; }
.meta div { min-width: 0; }
.meta dt { font: 700 0.6875rem/1.2 var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.meta dd { margin: 0.3rem 0 0; font-size: 0.9375rem; line-height: 1.45; overflow-wrap: anywhere; }
.stats { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.5rem; }
.stats a { height: 100%; display: flex; flex-direction: column; gap: 0.25rem; padding: 0.8rem 0.9rem; border-radius: 12px; background: var(--bg); color: var(--ink); text-decoration: none; }
.stats a:hover { box-shadow: inset 0 0 0 1px var(--line-strong); }
.stats b { font: 600 1.5rem/1 var(--font-display); font-variant-numeric: tabular-nums; }
.stats span { font-size: 0.8125rem; line-height: 1.35; color: var(--muted); }
.stats .stat-questions { grid-column: 1 / -1; }
.bar { display: flex; height: 0.4rem; margin-top: 0.4rem; border-radius: 99px; overflow: hidden; background: var(--line); }
.bar-decided { background: var(--green); }
.bar-direction { background: var(--link); }
.bar-open { background: var(--amber-line); }

/* Sections */
.doc-section { display: flex; flex-direction: column; gap: 1rem; }
.doc-section + .doc-section { margin-top: 3.5rem; padding-top: 3rem; border-top: 1px solid var(--line); }
.doc-section > p, .doc-section > ul, .doc-section > ol:not(.triggers), .callout { max-width: 68ch; }
.doc-section p { margin: 0; }
h2 { margin: 0 0 0.5rem; display: flex; flex-direction: column; gap: 0.45rem; font: 700 clamp(1.6rem, 3.2vw, 2.05rem)/1.15 var(--font-display); letter-spacing: -0.01em; text-wrap: balance; }
h2 .num { font: 500 0.8125rem/1 var(--font-mono); letter-spacing: 0.02em; color: var(--muted); }
h3 { margin: 1.5rem 0 0; display: flex; align-items: baseline; gap: 0.65rem; font: 700 1.3125rem/1.3 var(--font-display); text-wrap: balance; }
h3 .num { flex: none; font: 500 0.8125rem/1 var(--font-mono); color: var(--muted); }
.group { margin-top: 0.75rem !important; font: 700 0.75rem/1.2 var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.doc-section ul, .doc-section ol { margin: 0; padding-left: 1.3rem; }
.doc-section li + li { margin-top: 0.35rem; }
.doc-section li > ul, .doc-section li > ol { margin-top: 0.35rem; }
li::marker { color: var(--muted); }

/* Labels from the document's own legend */
.tag { display: inline-flex; align-items: center; padding: 0.3em 0.6em; border-radius: 99px; font: 700 0.6875rem/1 var(--font-display); letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; vertical-align: 0.1em; text-decoration: none; }
.tag-proposed { background: var(--brand-soft); color: var(--brand); }
.tag-decision { background: var(--green-soft); color: var(--green); }
.tag-assumption, .tag-hypothesis, .tag-open { background: var(--amber-soft); color: var(--amber); }
.tag-target { box-shadow: inset 0 0 0 1px var(--brand); color: var(--brand); }
.tag-req { box-shadow: inset 0 0 0 1px var(--line-strong); color: var(--ink); }
a.tag:hover { box-shadow: inset 0 0 0 1px currentColor; }
.id { display: inline-block; padding: 0.15em 0.4em; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); font: 500 0.8125rem/1.3 var(--font-mono); white-space: nowrap; color: var(--ink); }
.cite { display: inline-block; padding: 0.1em 0.3em; border: 1px solid var(--line); border-radius: 4px; font: 500 0.6875rem/1.2 var(--font-mono); color: var(--link); text-decoration: none; vertical-align: 0.12em; white-space: nowrap; }
a.cite:hover { border-color: var(--link); }
.xref { white-space: nowrap; }

/* Callouts and quotes */
.callout { margin: 0; padding: 0.9rem 1.1rem; border: 1px solid; border-radius: 12px; font-size: 0.96875rem; }
.callout-caution { background: var(--amber-soft); border-color: var(--amber-line); }
.callout-done { background: var(--green-soft); border-color: transparent; }
.callout-draft { background: var(--bg); border: 1px dashed var(--line-strong); }
.pull { margin: 0.25rem 0; max-width: 40ch; font: italic 500 1.375rem/1.45 var(--font-display); color: var(--brand); }

/* The three triggers */
.triggers { list-style: none; margin: 0.25rem 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.75rem; }
.doc-section .triggers li + li { margin-top: 0; }
.trigger { display: flex; flex-direction: column; gap: 0.8rem; padding: 1rem 1.1rem 1.15rem; border: 1px solid var(--line); border-radius: 14px; background: var(--bg); }
.trigger p { font: 600 1.0625rem/1.4 var(--font-display); }
.trigger-glyph { height: 2rem; display: flex; align-items: center; }
.g-flag { width: 1.9rem; height: 1.9rem; display: grid; place-items: center; border: 1.5px solid currentColor; border-radius: 6px; font: 600 1rem/1 var(--font-mono); color: var(--red); }
.g-range { width: 7.5rem; height: 2rem; }
.rg-track { stroke: var(--line-strong); stroke-width: 2; stroke-linecap: round; fill: none; }
.rg-band { stroke: var(--brand); stroke-width: 6; stroke-linecap: round; fill: none; }
.rg-tick { stroke: var(--brand); stroke-width: 2; fill: none; }
.rg-dot { fill: var(--amber-line); }
.g-rule { padding: 0.35rem 0.6rem; border-radius: 8px; background: var(--brand-soft); color: var(--brand); font: 500 0.9375rem/1 var(--font-mono); }

/* Store / don't store */
.keep { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 0.75rem; }
.keep-col { min-width: 0; padding: 1rem 1.1rem 1.15rem; border-radius: 14px; border: 1px solid var(--line); }
.keep-yes { background: var(--green-soft); border-color: transparent; }
.keep-no { background: var(--bg); }
.keep-title { margin: 0 0 0.75rem !important; font: 700 0.75rem/1.2 var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; }
.keep-yes .keep-title, .keep-yes svg { color: var(--green); }
.keep-no .keep-title, .keep-no svg { color: var(--red); }
.keep ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.doc-section .keep li + li { margin-top: 0; }
.keep li { display: grid; grid-template-columns: 1.1rem minmax(0, 1fr); gap: 0.55rem; font-size: 0.96875rem; line-height: 1.5; }
.keep svg { width: 1.1rem; height: 1.1rem; margin-top: 0.2rem; }

/* Tables */
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; line-height: 1.5; }
table.wide { min-width: 46rem; }
th { padding: 0.65rem 0.9rem; text-align: left; vertical-align: bottom; background: var(--bg); border-bottom: 1px solid var(--line); font: 700 0.6875rem/1.3 var(--font-display); letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted); }
td { padding: 0.7rem 0.9rem; vertical-align: top; border-top: 1px solid var(--line); }
tbody tr:first-child td { border-top: 0; }
td:first-child { font-weight: 700; }
tr:target td { background: var(--brand-soft); }

/* Diagrams */
.diagram { margin: 0.25rem 0; padding: 1.25rem; overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; background: var(--bg); }
pre.mermaid { margin: 0; font: 0.8125rem/1.5 var(--font-mono); color: var(--muted); white-space: pre; }
pre.mermaid svg { display: block; margin: 0 auto; height: auto; }
pre.code { margin: 0; padding: 1rem; overflow-x: auto; border-radius: 12px; background: var(--bg); font: 0.875rem/1.5 var(--font-mono); }

/* Sources */
.sources { list-style: none; padding: 0 !important; }
.sources li { display: grid; grid-template-columns: 2.6rem minmax(0, 1fr); gap: 0.4rem; font-size: 0.9375rem; }
.sources li > span:last-child { overflow-wrap: anywhere; }
.sources .cite { justify-self: start; margin-top: 0.3rem; }

.doc-foot { margin-top: 4rem; padding-top: 1.5rem; border-top: 1px solid var(--line); font-size: 0.8125rem; color: var(--muted); }
.logo-bar { fill: var(--brand); }
.logo-accent { fill: #1e9e5e; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .logo-accent { fill: #56db8b; } }
:root[data-theme="dark"] .logo-accent { fill: #56db8b; }

@media (max-width: 1000px) {
  .shell { grid-template-columns: minmax(0, 1fr); gap: 1rem; padding-block: 1rem 3rem; }
  .rail { display: none; }
  .toc-mobile { display: block; }
  .toc-mobile summary { cursor: pointer; padding: 0.75rem 1rem; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); font: 600 0.9375rem/1.2 var(--font-display); }
  .toc-mobile[open] summary { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
  .toc-mobile .toc { padding: 0.5rem; border: 1px solid var(--line); border-top: 0; border-radius: 0 0 12px 12px; background: var(--surface); }
  .sheet { border-radius: 14px; }
}
@media print {
  .rail, .toc-mobile, .skip { display: none; }
  .shell { display: block; padding: 0; }
  .sheet { border: 0; padding: 0; }
  .doc-section { break-inside: auto; }
  a { color: inherit; }
}
</style>
</head>
<body>
<a class="skip" href="#doc">Skip to the document</a>
<div class="shell">
  <aside class="rail" aria-label="Contents">
    <nav>
      <a class="rail-head" href="#top">${LOGO}<span>${esc(productName)} PRD</span></a>
      <ol class="toc">${toc}</ol>
    </nav>
  </aside>
  <details class="toc-mobile">
    <summary>Contents</summary>
    <ol class="toc">${tocShort}</ol>
  </details>
  <main class="sheet" id="doc">
    <header class="doc-head" id="top">
      <div class="brand">${LOGO}<div><p class="eyebrow">${esc(documentName)}</p><h1>${esc(productName)}</h1></div></div>
      ${lede ? `<p class="lede">${inline(lede)}</p>` : ""}
      <dl class="meta">${meta}</dl>
      ${notice ? renderQuote(notice.text) : ""}
      <ul class="stats" aria-label="What this document holds">${stats}</ul>
    </header>
${body}
    <footer class="doc-foot">Built from <code>docs/PRD.md</code> on ${built}. Rebuild with <code>node docs/build-prd-html.mjs</code>.</footer>
  </main>
</div>
<script>
(() => {
  // Highlight the section being read in the contents rail.
  const items = new Map([...document.querySelectorAll(".rail li[data-target]")].map((li) => [li.dataset.target, li]));
  const nav = document.querySelector(".rail nav");
  const sections = [...document.querySelectorAll(".doc-section")];
  let active = null;
  let queued = false;
  const update = () => {
    queued = false;
    let current = null;
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= 160) current = s;
      else break;
    }
    const id = current?.id ?? null;
    if (id === active) return;
    items.get(active)?.classList.remove("is-active");
    const li = items.get(id);
    li?.classList.add("is-active");
    active = id;
    if (li && nav && (li.offsetTop < nav.scrollTop || li.offsetTop > nav.scrollTop + nav.clientHeight - 80)) nav.scrollTop = li.offsetTop - nav.clientHeight / 3;
  };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  update();

  document.querySelectorAll(".toc-mobile a").forEach((a) => a.addEventListener("click", () => { a.closest("details").open = false; }));

  // Diagrams: use the host's own renderer when there is one, otherwise load mermaid.
  setTimeout(() => {
    const pending = [...document.querySelectorAll("pre.mermaid")].filter((p) => !p.querySelector("svg") && !p.hasAttribute("data-processed"));
    if (!pending.length) return;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js";
    script.onload = () => {
      const css = getComputedStyle(document.documentElement);
      const v = (name) => css.getPropertyValue(name).trim();
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: v("--font-body"),
        themeVariables: {
          background: v("--bg"), primaryColor: v("--surface"), primaryTextColor: v("--ink"), primaryBorderColor: v("--line-strong"),
          secondaryColor: v("--brand-soft"), tertiaryColor: v("--bg"), lineColor: v("--muted"), textColor: v("--ink"),
          clusterBkg: v("--surface"), clusterBorder: v("--line-strong"), edgeLabelBackground: v("--bg"),
          actorBkg: v("--surface"), actorBorder: v("--line-strong"), actorTextColor: v("--ink"), actorLineColor: v("--line-strong"),
          signalColor: v("--ink"), signalTextColor: v("--ink"), noteBkgColor: v("--amber-soft"), noteTextColor: v("--ink"),
        },
      });
      window.mermaid.run({ nodes: pending });
    };
    document.head.appendChild(script);
  }, 400);
})();
</script>
</body>
</html>
`;

writeFileSync(OUTPUT, page);
console.log(
  `Wrote ${path.relative(process.cwd(), OUTPUT)}: ${sections.length} sections, ${counts.fr} FRs, ${counts.nfr} NFRs, ` +
    `${questions.length} questions (${questionCounts.decided} decided, ${questionCounts.partial} partly settled, ${questionCounts.open} open).`,
);
