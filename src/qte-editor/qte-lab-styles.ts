/** Embedded because the extension host loads the JavaScript bundle directly. */
export const QTE_LAB_STYLES = `
.qte-lab-scope {
  --ql-bg: var(--surface-app,#fbfbfc);
  --ql-canvas: var(--surface-canvas,#fff);
  --ql-panel: var(--surface-subtle,#f6f6f8);
  --ql-hover: var(--surface-muted,#f0f0f3);
  --ql-sunken: var(--surface-sunken,#ebebef);
  --ql-overlay: var(--surface-overlay,rgba(255,255,255,.98));
  --ql-text: var(--text-primary,#09090b);
  --ql-secondary: var(--text-secondary,#3f3f46);
  --ql-muted: var(--text-tertiary,#71717a);
  --ql-line: var(--border-default,rgba(0,0,0,.09));
  --ql-line-strong: var(--border-strong,rgba(0,0,0,.15));
  --ql-accent: var(--accent,#f43f5e);
  --ql-accent-soft: var(--accent-soft,#fff1f3);
  --ql-accent-fg: var(--accent-fg,#fff);
  --ql-danger: var(--error,var(--state-error,#dc2626));
  --ql-warning: var(--warn,var(--state-warning,#b45309));
  --ql-shadow: var(--elev-2,0 8px 24px rgba(0,0,0,.12));
  --ql-font-ui: 'MiSans','PingFang SC','Microsoft YaHei UI',sans-serif;
  --ql-font-mono: 'Geist Mono','JetBrains Mono','SF Mono',Consolas,monospace;
  width:100%;
  height:100%;
  min-width:0;
  min-height:0;
  color:var(--ql-text);
  font:13px/1.5 var(--ql-font-ui);
}
.qte-lab-scope *, .qte-lab-scope *::before, .qte-lab-scope *::after { box-sizing:border-box; }
.qte-lab-scope button, .qte-lab-scope input, .qte-lab-scope select, .qte-lab-scope textarea { font:inherit; }
.qte-lab-scope button { cursor:pointer; }
.qte-lab-scope button:disabled { cursor:default; opacity:.42; }
.qte-lab-scope button:focus-visible, .qte-lab-scope input:focus-visible, .qte-lab-scope select:focus-visible, .qte-lab-scope textarea:focus-visible {
  outline:2px solid var(--ql-accent); outline-offset:2px;
}
.qte-style-lab, .qte-style-lab * {
  scrollbar-width:thin;
  scrollbar-color:color-mix(in srgb,var(--ql-muted) 34%,transparent) transparent;
}
.qte-style-lab {
  width:100%;
  height:100%;
  min-height:420px;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  position:relative;
  background:var(--ql-bg);
  color:var(--ql-text);
  container-type:inline-size;
}
.ql-button {
  min-height:30px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  padding:5px 10px;
  border:1px solid var(--ql-line);
  border-radius:7px;
  background:var(--ql-canvas);
  color:var(--ql-text);
  transition:background .14s,border-color .14s,color .14s;
}
.ql-button:hover:not(:disabled) { background:var(--ql-hover); border-color:var(--ql-line-strong); }
.ql-button[aria-pressed=true] { color:var(--ql-accent); border-color:color-mix(in srgb,var(--ql-accent) 65%,var(--ql-line)); background:var(--ql-accent-soft); }
.ql-button.ql-primary { color:var(--ql-accent-fg); background:var(--ql-accent); border-color:var(--ql-accent); font-weight:650; }
.ql-button.ql-quiet { background:transparent; }
.ql-button.ql-icon { width:31px; padding:0; font-size:15px; }
.ql-header {
  flex:0 0 auto;
  display:flex;
  align-items:center;
  gap:13px;
  padding:15px 20px;
  border-bottom:1px solid var(--ql-line);
  background:var(--ql-canvas);
}
.ql-logo {
  width:38px; height:38px; flex:0 0 38px;
  display:grid; place-items:center;
  border-radius:10px;
  background:var(--ql-accent-soft);
  border:1px solid color-mix(in srgb,var(--ql-accent) 28%,var(--ql-line));
  color:var(--ql-accent);
  font-size:18px;
  font-weight:800;
}
.ql-heading { min-width:0; }
.ql-heading h1 { margin:0; font-size:18px; line-height:1.2; font-weight:680; letter-spacing:.025em; }
.ql-heading p { margin:3px 0 0; color:var(--ql-muted); font-size:9px; letter-spacing:.18em; }
.ql-header-actions { margin-left:auto; display:flex; align-items:center; justify-content:flex-end; gap:7px; flex-wrap:wrap; }
.ql-save-state {
  max-width:190px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  padding:4px 8px;
  border-radius:30px;
  color:var(--ql-muted);
  background:var(--ql-panel);
  border:1px solid var(--ql-line);
  font-size:10px;
}
.ql-save-state[data-error=true] { color:var(--ql-danger); }
.ql-body { min-height:0; flex:1; display:grid; grid-template-columns:218px minmax(320px,1fr) 304px; overflow:hidden; }
.ql-presets {
  min-height:0;
  overflow:auto;
  padding:16px 13px;
  border-right:1px solid var(--ql-line);
  background:var(--ql-panel);
}
.ql-section-title {
  display:flex; align-items:center; justify-content:space-between;
  margin:0 0 12px;
  color:var(--ql-muted);
  font-size:10px;
  font-weight:700;
  letter-spacing:.14em;
}
.ql-section-title span { padding:1px 5px; border-radius:4px; letter-spacing:0; background:var(--ql-hover); color:var(--ql-secondary); }
.ql-filter { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:11px; }
.ql-filter .ql-button { min-height:25px; padding:3px 7px; font-size:10px; }
.ql-preset-list { display:grid; gap:8px; }
.ql-preset {
  width:100%;
  min-width:0;
  display:grid;
  grid-template-columns:42px minmax(0,1fr);
  gap:10px;
  align-items:center;
  padding:9px;
  text-align:left;
  border:1px solid var(--ql-line);
  border-radius:8px;
  background:var(--ql-canvas);
  color:var(--ql-text);
  position:relative;
}
.ql-preset:hover { background:var(--ql-hover); border-color:var(--ql-line-strong); }
.ql-preset[aria-pressed=true] { background:var(--ql-accent-soft); border-color:color-mix(in srgb,var(--ql-accent) 58%,var(--ql-line)); box-shadow:inset 3px 0 var(--ql-accent); }
.ql-preset-art {
  width:42px; height:42px;
  display:grid; place-items:center;
  border-radius:7px;
  background:radial-gradient(circle,var(--preset-glow),#071018 72%);
  overflow:hidden;
}
.ql-preset-art i {
  width:26px; height:26px;
  border:3px var(--preset-pattern) var(--preset-color);
  border-radius:var(--preset-radius);
  transform:rotate(var(--preset-rotation));
  box-shadow:0 0 10px var(--preset-glow);
}
.ql-preset-copy { min-width:0; display:block; }
.ql-preset-copy strong { display:block; margin-bottom:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; font-weight:650; }
.ql-preset-copy small { display:block; color:var(--ql-muted); font-size:9.5px; line-height:1.35; }
.ql-preset-help { margin:12px 2px 0; color:var(--ql-muted); font-size:10px; line-height:1.55; }
.ql-workspace { min-width:0; min-height:0; overflow:auto; padding:18px; display:flex; flex-direction:column; gap:12px; }
.ql-workspace-top { display:flex; align-items:flex-start; gap:12px; }
.ql-workspace-title { min-width:0; }
.ql-eyebrow { color:var(--ql-accent); font-size:9px; font-weight:700; letter-spacing:.15em; }
.ql-workspace-title h2 { margin:3px 0 2px; font-size:19px; font-weight:670; }
.ql-workspace-title p { margin:0; color:var(--ql-muted); font-size:11px; }
.ql-live {
  margin-left:auto;
  padding:4px 8px;
  border:1px solid color-mix(in srgb,#16a34a 36%,var(--ql-line));
  border-radius:30px;
  color:#15803d;
  background:color-mix(in srgb,#16a34a 9%,var(--ql-canvas));
  font:700 9px/1 var(--ql-font-mono);
  letter-spacing:.1em;
}
.ql-live[data-paused=true] { color:var(--ql-muted); border-color:var(--ql-line); background:var(--ql-panel); }
.ql-stage-card { min-height:320px; border:1px solid var(--ql-line); border-radius:9px; background:var(--ql-canvas); box-shadow:var(--ql-shadow); overflow:hidden; }
.ql-stage {
  position:relative;
  width:100%;
  aspect-ratio:16/9;
  min-height:260px;
  max-height:560px;
  overflow:hidden;
  background:#101522;
}
.ql-stage[data-background=night] { background:radial-gradient(circle at 55% 42%,#25304a,#0a0f1c 66%); }
.ql-stage[data-background=warm] { background:linear-gradient(145deg,#3b2b31,#15131a 65%); }
.ql-stage[data-background=light] { background:linear-gradient(145deg,#e8eaee,#bfc4ce); }
.ql-stage[data-background=checker] { background-color:#b8bdc8; background-image:linear-gradient(45deg,#d8dbe2 25%,transparent 25%),linear-gradient(-45deg,#d8dbe2 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d8dbe2 75%),linear-gradient(-45deg,transparent 75%,#d8dbe2 75%); background-size:24px 24px; background-position:0 0,0 12px,12px -12px,-12px 0; }
.ql-grid {
  position:absolute; inset:0; z-index:0; pointer-events:none; opacity:.22;
  background-image:linear-gradient(rgba(255,255,255,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.16) 1px,transparent 1px);
  background-size:10% 10%;
}
.ql-stage-badge, .ql-stage-tip {
  position:absolute; z-index:2; bottom:9px; color:rgba(255,255,255,.55);
  font:9px/1 var(--ql-font-mono); letter-spacing:.08em; pointer-events:none;
}
.ql-stage-badge { left:11px; }
.ql-stage-tip { right:11px; }
.ql-stage-toolbar { min-height:44px; display:flex; align-items:center; gap:7px; padding:7px 9px; border-top:1px solid var(--ql-line); background:var(--ql-panel); }
.ql-toolbar-right { margin-left:auto; display:flex; gap:7px; align-items:center; }
.ql-select { min-height:30px; padding:4px 24px 4px 7px; border:1px solid var(--ql-line-strong); border-radius:6px; background:var(--ql-canvas); color:var(--ql-text); }
.ql-mode-toggle { display:flex; gap:3px; padding:2px; border-radius:7px; background:var(--ql-sunken); }
.ql-mode-toggle .ql-button { min-height:26px; border-color:transparent; background:transparent; font-size:10px; }
.ql-mode-toggle .ql-button[aria-pressed=true] { background:var(--ql-canvas); color:var(--ql-accent); border-color:var(--ql-line); }
.ql-timeline { padding:12px 14px; border:1px solid var(--ql-line); border-radius:8px; background:var(--ql-canvas); }
.ql-timeline-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:9px; color:var(--ql-secondary); }
.ql-timeline-head strong { font-size:11px; }
.ql-timeline-head output { color:var(--ql-muted); font:10px/1 var(--ql-font-mono); }
.ql-time-slider { width:100%; accent-color:var(--ql-accent); cursor:pointer; }
.ql-window-track { height:5px; margin:4px 2px 0; border-radius:9px; background:var(--ql-sunken); overflow:hidden; }
.ql-window-track i { display:block; height:100%; border-radius:9px; background:var(--ql-accent); }
.ql-window-caption { display:flex; justify-content:space-between; margin-top:5px; color:var(--ql-muted); font-size:9px; }
.ql-statbar { display:grid; grid-template-columns:repeat(4,1fr); border:1px solid var(--ql-line); border-radius:8px; background:var(--ql-canvas); overflow:hidden; }
.ql-stat { padding:8px 10px; border-right:1px solid var(--ql-line); }
.ql-stat:last-child { border-right:0; }
.ql-stat span { display:block; color:var(--ql-muted); font-size:8px; letter-spacing:.1em; }
.ql-stat strong { font:650 15px/1.4 var(--ql-font-mono); }
.ql-inspector { min-height:0; overflow:auto; border-left:1px solid var(--ql-line); background:var(--ql-panel); }
.ql-inspector-head { position:sticky; top:0; z-index:3; padding:15px 14px 11px; background:color-mix(in srgb,var(--ql-panel) 94%,transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--ql-line); }
.ql-inspector-head h2 { margin:0; font-size:13px; }
.ql-inspector-head p { margin:3px 0 0; color:var(--ql-muted); font-size:10px; }
.ql-layer-tabs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; padding:10px; border-bottom:1px solid var(--ql-line); }
.ql-layer-tabs .ql-button { min-width:0; justify-content:flex-start; padding:5px 7px; font-size:10px; }
.ql-fields { padding:12px; display:grid; gap:14px; }
.ql-field { min-width:0; display:grid; gap:6px; }
.ql-field-title { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.ql-field-title label, .ql-field-title span:first-child { color:var(--ql-secondary); font-size:10px; font-weight:600; }
.ql-field-title output { color:var(--ql-muted); font:9.5px/1 var(--ql-font-mono); }
.ql-field-row { display:grid; grid-template-columns:minmax(0,1fr) 70px; gap:7px; align-items:center; }
.ql-field input[type=range] { width:100%; min-width:0; accent-color:var(--ql-accent); }
.ql-field input[type=number], .ql-field input[type=text], .ql-field select {
  width:100%; min-width:0; min-height:29px; padding:4px 7px;
  border:1px solid var(--ql-line-strong); border-radius:5px;
  background:var(--ql-sunken); color:var(--ql-text);
}
.ql-color-row { display:grid; grid-template-columns:31px minmax(0,1fr); gap:7px; }
.ql-color-swatch { position:relative; width:31px; height:31px; border:1px solid var(--ql-line-strong); border-radius:6px; overflow:hidden; background-image:linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%); background-size:8px 8px; background-position:0 0,0 4px,4px -4px,-4px 0; }
.ql-color-swatch i { position:absolute; inset:0; background:var(--field-color); }
.ql-color-swatch input { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; }
.ql-help { margin:0; color:var(--ql-muted); font-size:9.5px; line-height:1.45; }
.ql-prompt-input { margin:0 12px 14px; padding-top:12px; border-top:1px solid var(--ql-line); }
.ql-prompt-input label { display:block; margin-bottom:5px; color:var(--ql-secondary); font-size:10px; font-weight:600; }
.ql-prompt-input input { width:100%; min-height:30px; padding:5px 7px; border:1px solid var(--ql-line-strong); border-radius:5px; background:var(--ql-sunken); color:var(--ql-text); }
.ql-inspector-note { margin:0 12px 14px; padding:9px; border:1px solid var(--ql-line); border-radius:7px; color:var(--ql-muted); background:var(--ql-canvas); font-size:9.5px; line-height:1.5; }
.ql-footer { flex:0 0 auto; min-height:27px; display:flex; align-items:center; gap:12px; padding:4px 12px; border-top:1px solid var(--ql-line); background:var(--ql-panel); color:var(--ql-muted); font-size:9px; }
.ql-footer span:last-child { margin-left:auto; font-family:var(--ql-font-mono); letter-spacing:.08em; }
.ql-modal-backdrop { position:absolute; inset:0; z-index:20; display:flex; justify-content:flex-end; background:rgba(0,0,0,.28); }
.ql-json-panel { width:min(480px,90%); height:100%; display:flex; flex-direction:column; gap:12px; padding:18px; background:var(--ql-overlay); border-left:1px solid var(--ql-line); box-shadow:-12px 0 40px rgba(0,0,0,.18); }
.ql-json-head { display:flex; align-items:flex-start; gap:12px; }
.ql-json-head h2 { margin:0; font-size:16px; }
.ql-json-head p { margin:3px 0 0; color:var(--ql-muted); font-size:10px; }
.ql-json-head .ql-button { margin-left:auto; }
.ql-json-panel textarea { min-height:0; flex:1; width:100%; resize:none; padding:11px; border:1px solid var(--ql-line-strong); border-radius:7px; background:var(--ql-sunken); color:var(--ql-text); font:11px/1.55 var(--ql-font-mono); }
.ql-json-feedback { min-height:20px; color:var(--ql-muted); font-size:10px; }
.ql-json-feedback[data-error=true] { color:var(--ql-danger); }
.ql-json-actions { display:flex; flex-wrap:wrap; gap:7px; }
@container (max-width: 900px) {
  .ql-body { grid-template-columns:190px minmax(300px,1fr); }
  .ql-inspector { position:absolute; right:0; top:69px; bottom:27px; width:304px; z-index:8; box-shadow:-10px 0 30px rgba(0,0,0,.12); }
  .ql-workspace { padding-right:322px; }
}
@container (max-width: 680px) {
  .ql-header { padding:10px 12px; }
  .ql-heading p, .ql-save-state { display:none; }
  .ql-body { display:block; overflow:auto; }
  .ql-presets { border-right:0; border-bottom:1px solid var(--ql-line); overflow:visible; }
  .ql-preset-list { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .ql-workspace { padding:12px; }
  .ql-inspector { position:static; width:auto; overflow:visible; border-left:0; border-top:1px solid var(--ql-line); box-shadow:none; }
  .ql-layer-tabs { grid-template-columns:repeat(4,minmax(0,1fr)); }
  .ql-statbar { grid-template-columns:repeat(2,1fr); }
}
`;
