/**
 * The dashboard: one self-contained HTML page over the reports of one or more repositories.
 * No framework, no network needed - the data is embedded, the page runs anywhere it is opened
 * (the fonts load from Google when online and fall back to the system faces when not), and it
 * reads in light and dark. Built by `abatty dashboard`; the hosted version serves the same
 * reports through the same page.
 *
 * It is an instrument panel, not a document: the summary before the detail, state encoded in
 * form (a marker, a chip) as well as number, semantic colour kept apart from the accent.
 */

/**
 * @param {{ name: string, reports: import("../core/report.mjs").Report[] }[]} repos
 * @param {{ abattyVersion?: string }} [o]
 */
export function renderDashboard(repos, o = {}) {
  const data = JSON.stringify(repos.map((r) => ({ name: r.name, reports: r.reports })));
  const builtAt = new Date().toISOString();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>abatty</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --bg:#f2f5f5;--panel:#fbfcfc;--panel-2:#e9efee;--text:#13201f;--muted:#5e6e6d;--line:#d9e1e1;--line-2:#c6d2d1;
  --accent:#0b6e6e;--accent-ink:#ffffff;
  --ok:#2e9e44;--warn:#c27a00;--bad:#c43b3b;--na:#9aa9a8;
  --ok-bg:#e5f4e8;--warn-bg:#fbf0dc;--bad-bg:#f9e3e3;--na-bg:#eef1f1;
  --shadow:0 1px 0 rgba(19,32,31,.04),0 12px 32px -12px rgba(19,32,31,.18);
  --sans:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --display:"Bricolage Grotesque","IBM Plex Sans",ui-sans-serif,system-ui,sans-serif;
  color-scheme:light dark;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0d1414;--panel:#131c1c;--panel-2:#1a2626;--text:#e6eeee;--muted:#8fa3a2;--line:#213030;--line-2:#2c3d3d;
  --accent:#3fb8b8;--accent-ink:#0d1414;
  --ok:#4cc466;--warn:#e3a13a;--bad:#e4635f;--na:#6b7d7c;
  --ok-bg:#153a20;--warn-bg:#3a2a0e;--bad-bg:#3d1a1a;--na-bg:#1c2626;
  --shadow:0 1px 0 rgba(0,0,0,.4),0 16px 40px -16px rgba(0,0,0,.7);
}}
:root[data-theme="dark"]{
  --bg:#0d1414;--panel:#131c1c;--panel-2:#1a2626;--text:#e6eeee;--muted:#8fa3a2;--line:#213030;--line-2:#2c3d3d;
  --accent:#3fb8b8;--accent-ink:#0d1414;
  --ok:#4cc466;--warn:#e3a13a;--bad:#e4635f;--na:#6b7d7c;
  --ok-bg:#153a20;--warn-bg:#3a2a0e;--bad-bg:#3d1a1a;--na-bg:#1c2626;
  --shadow:0 1px 0 rgba(0,0,0,.4),0 16px 40px -16px rgba(0,0,0,.7);
}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 var(--sans);padding-inline:20px;padding-block:0 56px;font-variant-numeric:tabular-nums}
a{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.wrap{max-width:1160px;margin:0 auto}
/* readout strip */
.strip{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 0 12px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.brand{display:flex;align-items:baseline;gap:10px}
.brand .name{font:700 22px/1 var(--display);letter-spacing:-.02em}
.brand .name i{font-style:normal;color:var(--accent)}
.brand .ver{font:12px var(--mono);color:var(--muted)}
.tabs{display:flex;gap:4px;flex-wrap:wrap}
.tab{border:1px solid var(--line-2);background:transparent;color:var(--text);padding:6px 12px;border-radius:6px;cursor:pointer;font:500 13px var(--sans)}
.tab[aria-selected="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.tools{display:flex;gap:10px;align-items:center;color:var(--muted);font:12px var(--mono)}
.tools button{border:1px solid var(--line-2);background:transparent;color:var(--muted);padding:5px 10px;border-radius:6px;cursor:pointer;font:12px var(--mono)}
/* hero */
.hero{display:grid;grid-template-columns:200px 1fr;gap:28px;align-items:center;margin:22px 0 8px;padding:22px 26px;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow)}
.dial{width:200px;height:200px;display:block}
.dial text{font-family:var(--display);fill:var(--text)}
.dial .track{stroke:var(--panel-2)}.dial .arc{stroke:var(--accent)}.dial .tick{stroke:var(--line-2)}
.dial .n{font-size:58px;font-weight:700;letter-spacing:-.04em}.dial .of{font-size:14px;fill:var(--muted);font-family:var(--mono);font-weight:400}
.hero-body{display:grid;gap:14px;min-width:0}
.hero h1{margin:0;font:600 24px/1.15 var(--display);letter-spacing:-.01em;text-wrap:balance}
.hero h1 small{display:block;font:13px var(--mono);color:var(--muted);margin-top:6px;font-weight:400}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:8px;padding:6px 10px 6px 8px;border-radius:6px;font:500 13px var(--sans);border:1px solid var(--line)}
.chip i{width:9px;height:9px;border-radius:2px;flex:none}
.chip b{font-family:var(--mono);font-weight:500}
.chip.ok{background:var(--ok-bg)}.chip.ok i{background:var(--ok)}
.chip.warn{background:var(--warn-bg)}.chip.warn i{background:var(--warn)}
.chip.bad{background:var(--bad-bg)}.chip.bad i{background:var(--bad)}
.chip.na{background:var(--na-bg)}.chip.na i{background:var(--na)}
.trend{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end}
.trend svg{width:100%;height:52px;display:block}
.trend .lbl{font:12px var(--mono);color:var(--muted);text-align:right;white-space:nowrap}
/* sections */
.cols{display:grid;grid-template-columns:7fr 5fr;gap:36px;margin-top:26px}
section h2{margin:0 0 12px;font:600 12px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.famrow{display:grid;grid-template-columns:110px 1fr 96px;gap:14px;align-items:center;padding:7px 0;border-top:1px solid var(--line)}
.famrow:first-of-type{border-top:0}
.famrow .f{font-weight:500}
.stack{height:8px;border-radius:2px;overflow:hidden;background:var(--panel-2);display:flex}
.stack i{display:block;height:100%}
.stack .p{background:var(--ok)}.stack .q{background:var(--warn)}.stack .m{background:var(--bad)}
.counts{font:12px var(--mono);color:var(--muted);text-align:right;white-space:nowrap}
.counts b{color:var(--text);font-weight:500}
ol.next{margin:0;padding:0;list-style:none;display:grid;gap:10px}
ol.next li{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:10px 0;border-top:1px solid var(--line)}
ol.next li:first-child{border-top:0;padding-top:0}
.phase{font:500 11px var(--mono);color:var(--accent);border:1px solid var(--accent);border-radius:4px;padding:2px 6px;white-space:nowrap;margin-top:2px}
ol.next b{display:block;font:500 13px var(--mono)}
ol.next span{color:var(--muted)}
/* nights */
.nights{margin-top:30px;display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.nights div{padding:14px 16px;border-left:1px solid var(--line)}
.nights div:first-child{border-left:0}
.nights .k{font:11px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.nights .v{font:600 20px/1.2 var(--display);margin-top:4px;letter-spacing:-.01em}
.nights .v.ok{color:var(--ok)}.nights .v.warn{color:var(--warn)}.nights .v.bad{color:var(--bad)}
.nights .s{font:12px var(--mono);color:var(--muted);margin-top:2px}
/* table */
.checks{margin-top:32px}
.filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.filters button{border:1px solid var(--line-2);background:transparent;color:var(--muted);padding:5px 10px;border-radius:6px;cursor:pointer;font:12px var(--mono)}
.filters button[aria-pressed="true"]{background:var(--text);color:var(--bg);border-color:var(--text)}
.tablewrap{overflow-x:auto;border-top:2px solid var(--line-2)}
table{width:100%;border-collapse:collapse;font-size:13px;min-width:820px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font:500 11px var(--mono);letter-spacing:.1em;text-transform:uppercase}
td.id,td.ph{font-family:var(--mono);font-size:12px;white-space:nowrap}
td.ev{color:var(--muted)}
.st{display:inline-flex;align-items:center;gap:6px;font:500 12px var(--mono)}
.st i{width:8px;height:8px;border-radius:2px}
.st.present i{background:var(--ok)}.st.partial i{background:var(--warn)}.st.missing i{background:var(--bad)}.st.na i,.st.waived i{background:var(--na)}
.st.missing{color:var(--bad)}.st.partial{color:var(--warn)}
footer{color:var(--muted);font:12px var(--mono);margin-top:28px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:12px}
.empty{padding:40px 0;color:var(--muted)}
@media (max-width:860px){.hero{grid-template-columns:1fr;justify-items:center;text-align:center}.hero-body{justify-items:center}.cols{grid-template-columns:1fr;gap:28px}.nights{grid-template-columns:repeat(2,1fr)}.nights div:nth-child(3){border-left:0}.nights div:nth-child(n+3){border-top:1px solid var(--line)}}
@media (prefers-reduced-motion:no-preference){.dial .arc{transition:stroke-dasharray .6s ease}}
</style>
</head>
<body>
<div class="wrap">
  <div class="strip">
    <div class="brand"><span class="name">abatt<i>y</i></span><span class="ver">${o.abattyVersion ? "v" + o.abattyVersion : ""}</span></div>
    <div class="tabs" id="tabs" role="tablist" aria-label="repositories"></div>
    <div class="tools"><span id="built"></span><button id="theme" type="button" aria-label="switch theme">theme</button></div>
  </div>
  <main id="main"></main>
  <footer><span>a present check means the mechanism exists, not that it is green today - the gate says that</span><span id="foot"></span></footer>
</div>
<script>
const DATA = ${data};
const BUILT = ${JSON.stringify(builtAt)};
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let repoIndex = 0, filter = "todo";
try { const t = localStorage.getItem("abatty.theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
$("#theme").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("abatty.theme", next); } catch {}
});
$("#built").textContent = "built " + BUILT.slice(0, 16).replace("T", " ");
function tabs() {
  const el = $("#tabs"); el.innerHTML = "";
  DATA.forEach((r, i) => {
    const b = document.createElement("button"); b.className = "tab"; b.type = "button"; b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(i === repoIndex)); b.textContent = r.name;
    b.addEventListener("click", () => { repoIndex = i; render(); });
    el.appendChild(b);
  });
}
// The score dial: a 270-degree arc on one scale, ticks at the bands the terminal colours use (70, 90).
function dial(score) {
  const r = 78, c = 2 * Math.PI * r, span = 0.75, cx = 100, cy = 100;
  const len = (v) => (v / 100) * c * span;
  const tick = (v) => { const a = (-225 + (v / 100) * 270) * Math.PI / 180; const x1 = cx + Math.cos(a) * (r - 12), y1 = cy + Math.sin(a) * (r - 12), x2 = cx + Math.cos(a) * (r + 12), y2 = cy + Math.sin(a) * (r + 12); return '<line class="tick" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke-width="2"/>'; };
  return '<svg class="dial" viewBox="0 0 200 200" role="img" aria-label="score ' + score + ' of 100">' +
    '<circle class="track" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + len(100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(135 ' + cx + ' ' + cy + ')"/>' +
    '<circle class="arc" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + len(score).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(135 ' + cx + ' ' + cy + ')"/>' +
    tick(70) + tick(90) +
    '<text class="n" x="100" y="112" text-anchor="middle">' + score + '</text><text class="of" x="100" y="136" text-anchor="middle">of 100</text></svg>';
}
function spark(reports) {
  const w = 320, h = 52, pad = 6;
  if (reports.length < 2) return '<svg viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><line x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - pad) + '" y2="' + (h - pad) + '" stroke="var(--line-2)" stroke-dasharray="3 4"/></svg>';
  const xs = reports.map((_, i) => pad + (i * (w - 2 * pad)) / (reports.length - 1));
  const ys = reports.map((r) => h - pad - ((r.score || 0) / 100) * (h - 2 * pad));
  const d = xs.map((x, i) => (i ? "L" : "M") + x.toFixed(1) + " " + ys[i].toFixed(1)).join(" ");
  const area = d + " L" + xs.at(-1).toFixed(1) + " " + (h - pad) + " L" + xs[0].toFixed(1) + " " + (h - pad) + " Z";
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><line x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - pad) + '" y2="' + (h - pad) + '" stroke="var(--line-2)"/><path d="' + area + '" fill="var(--accent)" opacity=".12"/><path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2"/><circle cx="' + xs.at(-1).toFixed(1) + '" cy="' + ys.at(-1).toFixed(1) + '" r="3.5" fill="var(--accent)"/></svg>';
}
function phaseOrder(p) { const m = String(p).match(/\d+/); return m ? Number(m[0]) : 99; }
function render() {
  tabs();
  const repo = DATA[repoIndex]; const reports = repo.reports; const r = reports.at(-1);
  if (!r) { $("#main").innerHTML = '<p class="empty">No report yet. Run <code>abatty measure</code>.</p>'; return; }
  const n = (s) => r.findings.filter((f) => f.status === s).length;
  const present = n("present"), partial = n("partial"), missing = n("missing"), na = n("n/a");
  const phases = r.night && r.night.state && Array.isArray(r.night.state.phases) ? r.night.state.phases : [];
  const done = phases.filter((p) => p.status === "done").length;
  const next = r.findings.filter((f) => f.status === "missing" || f.status === "partial").sort((a, b) => phaseOrder(a.phase) - phaseOrder(b.phase) || (a.level === "should" ? 1 : 0) - (b.level === "should" ? 1 : 0)).slice(0, 7);
  const rows = r.findings.filter((f) => filter === "all" ? true : filter === "todo" ? f.status === "missing" || f.status === "partial" : f.status === filter);
  const chip = (cls, count, label) => '<span class="chip ' + cls + '"><i></i><b>' + count + '</b> ' + label + '</span>';
  const cell = (k, v, cls, s) => '<div><div class="k">' + k + '</div><div class="v ' + (cls || "") + '">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
  $("#main").innerHTML =
    '<section class="hero">' + dial(r.score) +
      '<div class="hero-body"><h1>' + esc(r.name) + '<small>' + esc(r.branch) + ' @ ' + esc(r.commit) + ' · ' + esc(r.date) + ' · ' + r.applicable + ' applicable checks</small></h1>' +
      '<div class="chips">' + chip("ok", present, "present") + chip("warn", partial, "partial") + chip("bad", missing, "missing") + (na ? chip("na", na, "not applicable") : "") + (r.scrub && r.scrub.enabled ? chip(r.scrub.lines ? "bad" : "ok", r.scrub.lines, r.scrub.lines ? "lines naming a tool" : "no trace of the tools") : "") + (r.enforced && r.enforced.share !== null ? chip(r.enforced.share >= 70 ? "ok" : "warn", r.enforced.share + "%", "of " + r.enforced.total + " present rules held by a machine") : "") + '</div>' +
      '<div class="trend">' + spark(reports) + '<div class="lbl">' + (reports.length > 1 ? reports.length + ' readings · ' + reports[0].score + ' → ' + r.score : 'first reading · run again for a trend') + '</div></div></div></section>' +
    '<div class="cols"><section><h2>By family</h2>' + r.families.map((f) => { const t = f.present + f.partial + f.missing; const pc = (x) => t ? (100 * x / t).toFixed(1) + '%' : '0%';
      return '<div class="famrow"><div class="f">' + esc(f.name) + '</div><div class="stack" role="img" aria-label="' + f.present + ' present, ' + f.partial + ' partial, ' + f.missing + ' missing"><i class="p" style="width:' + pc(f.present) + '"></i><i class="q" style="width:' + pc(f.partial) + '"></i><i class="m" style="width:' + pc(f.missing) + '"></i></div><div class="counts"><b>' + f.present + '</b> · ' + f.partial + ' · ' + f.missing + (f.na ? ' <span title="not applicable">(' + f.na + ')</span>' : '') + '</div></div>'; }).join("") + '</section>' +
    '<section><h2>Next, in plan order</h2>' + (next.length ? '<ol class="next">' + next.map((f) => '<li><span class="phase">phase ' + esc(f.phase) + '</span><div><b>' + esc(f.id) + '</b><span>' + esc(f.next) + '</span></div></li>').join("") + '</ol>' : '<p class="empty">Nothing missing or partial.</p>') + '</section></div>' +
    '<section class="nights">' +
      cell("harness", r.harness.present ? (r.harness.drift || r.harness.missing ? "drift" : "in step") : "absent", r.harness.present ? (r.harness.drift || r.harness.missing ? "warn" : "ok") : "bad", r.harness.present ? r.harness.drift + " differ · " + r.harness.missing + " missing" : "abatty init") +
      cell("phases", phases.length ? done + " / " + phases.length : "-", phases.length && done === phases.length ? "ok" : "", phases.length ? "done in unattended nights" : "no night yet") +
      cell("decisions", String(r.night.decisions), "", "taken alone, recorded") +
      cell("last night", r.night.lastReport ? esc(r.night.lastReport.replace(/^docs\\//, "").replace(/ADOPTION_REPORT_|\\.md/g, "")) : "-", "", r.night.lastReport ? esc(r.night.lastReport) : "") + '</section>' +
    '<section class="checks"><h2>Every check</h2><div class="filters">' + [["todo", "to do"], ["all", "all"], ["present", "present"], ["partial", "partial"], ["missing", "missing"], ["n/a", "n/a"]].concat(r.findings.some((f) => f.status === "waived") ? [["waived", "waived"]] : []).map(([k, l]) => '<button type="button" data-f="' + k + '" aria-pressed="' + String(filter === k) + '">' + l + '</button>').join("") + '</div>' +
      '<div class="tablewrap"><table><thead><tr><th>ID</th><th>Family</th><th>Rule</th><th>Level</th><th>Insured by</th><th>Status</th><th>Evidence</th><th>Next</th><th>Phase</th></tr></thead><tbody>' +
      rows.map((f) => '<tr><td class="id">' + esc(f.id) + '</td><td>' + esc(f.family) + '</td><td>' + esc(f.rule) + '</td><td class="ph">' + esc(f.level || "") + '</td><td class="ph">' + esc(f.enforcement || "") + '</td><td><span class="st ' + (f.status === "n/a" ? "na" : f.status) + '"><i></i>' + esc(f.status) + '</span></td><td class="ev">' + esc(f.evidence) + '</td><td>' + (f.status === "present" || f.status === "n/a" || f.status === "waived" ? "" : esc(f.next)) + '</td><td class="ph">' + esc(f.phase) + '</td></tr>').join("") +
      (rows.length ? "" : '<tr><td colspan="9" class="empty">Nothing here.</td></tr>') + '</tbody></table></div></section>';
  $("#main").querySelectorAll(".filters button").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.f; render(); }));
  $("#foot").textContent = DATA.length + " repositor" + (DATA.length === 1 ? "y" : "ies") + " · " + reports.length + " reading" + (reports.length === 1 ? "" : "s");
}
render();
</script>
</body>
</html>
`;
}
