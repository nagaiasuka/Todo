/* global __dirname */
// Design aid generated from the actual serialized Expo widget layout.
// This is a browser approximation; it does not replace WidgetKit screenshots.
const fs = require('node:fs');
const path = require('node:path');
const { render } = require('../tests/helpers/lock-runtime.cjs');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);

function html(node) {
  if (!node || typeof node !== 'object') return '';
  if (Array.isArray(node)) return node.map(html).join('');
  const p = node.props ?? {}, styles = [], classes = ['node', node.type];
  for (const m of p.modifiers ?? []) {
    if (m.$type === 'font') {
      if (m.size) styles.push(`font-size:${m.size}px`);
      if (m.weight) styles.push(`font-weight:${({ medium:500, semibold:600, bold:700 })[m.weight] ?? 400}`);
    }
    if (m.$type === 'frame') for (const k of ['width','height']) if (m[k]) styles.push(`${k}:${m[k]}px`, 'flex-shrink:0');
    if (m.$type === 'lineLimit') styles.push(`-webkit-line-clamp:${m.limit}`);
    if (m.$type === 'foregroundStyle') classes.push('secondary');
    if (m.$type === 'monospacedDigit') styles.push('font-variant-numeric:tabular-nums');
    if (m.$type === 'opacity') styles.push(`opacity:${m.value}`);
    if (m.$type === 'layoutPriority') styles.push('flex:1');
    if (m.$type === 'multilineTextAlignment') styles.push(`text-align:${m.alignment === 'leading' ? 'left' : m.alignment}`);
    if (m.$type === 'padding') styles.push(`padding:${m.all ?? m.vertical ?? 0}px ${m.all ?? m.horizontal ?? 0}px`);
  }
  if (node.type === 'HStackView') styles.push(`gap:${p.spacing ?? 8}px`,`align-items:${p.alignment === 'firstTextBaseline' ? 'baseline' : 'center'}`);
  if (node.type === 'VStackView') styles.push(`gap:${p.spacing ?? 8}px`,`align-items:${p.alignment === 'leading' ? 'flex-start' : 'center'}`);
  let children = html(p.children);
  if (node.type === 'TextView') children = escape(p.text ?? '');
  if (node.type === 'ImageView') children = p.systemName === 'arrow.right' ? '→' : p.systemName === 'checkmark.circle' ? '✓' : '☷';
  return `<div class="${classes.join(' ')}" style="${styles.join(';')}">${children}</div>`;
}
const sample = { today: 3, next: '企画書の最終確認', nextDeadline: '今日 14:00', nextEmpty: false };
const widget = (props, family) => `<div class="widget ${family}">${html(render(props, family))}</div>`;
const variant = (title, props) => `<div class="variant"><span>${title}</span>${widget(props, 'accessoryRectangular')}</div>`;
const panel = mode => `<section class="panel ${mode}"><span class="eyebrow">${mode === 'dark' ? '暗い壁紙' : '明るい壁紙'}</span>
  <div class="date">10月29日 木曜日</div>${widget(sample, 'accessoryInline')}<div class="clock">9:41</div>
  <div class="widgets">${widget(sample, 'accessoryRectangular')}${widget(sample, 'accessoryCircular')}</div>
  <div class="variants">${variant('件数のみ', { today: 3 })}${variant('次のタスクのみ', { next: sample.next, nextDeadline: sample.nextDeadline })}${variant('今日0件・長いタスク名', { today: 0, next: '来月のプロジェクトに向けた資料をチームに共有する', nextDeadline: '10/30 09:00' })}${variant('両方オフ', {})}</div>
</section>`;
const document = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>Todo ロック画面デザイン</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:36px;background:#f7f5ef;color:#292e28;font-family:-apple-system,BlinkMacSystemFont,sans-serif}h1{font-size:24px;margin:0 0 8px}body>p{font-size:13px;color:#656b61;margin:0 0 24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:900px}.panel{border-radius:24px;padding:24px 32px;overflow:hidden}.dark{background:linear-gradient(150deg,#202e36,#111916);color:#fff}.light{background:linear-gradient(150deg,#e5e8dc,#d0d9cd);color:#18231a}.eyebrow{font-size:11px;opacity:.7}.date{text-align:center;font-size:13px;margin-top:16px}.clock{text-align:center;font-size:64px;font-weight:600;letter-spacing:-2px;line-height:1.2;margin:0 0 14px}.widgets{display:flex;justify-content:center;align-items:center;gap:18px}.widget{position:relative;flex:none}.accessoryRectangular{width:160px;height:72px}.accessoryCircular{width:72px;height:72px}.accessoryInline{width:285px;height:24px;margin:auto;font-size:12px;overflow:hidden}.widget>.node{width:100%;height:100%}.node{min-width:0;flex-shrink:1}.HStackView{display:flex;flex-direction:row}.VStackView{display:flex;flex-direction:column;justify-content:center}.TextView{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;line-height:1.18;flex-shrink:1}.ImageView{flex:none;line-height:1}.RectangleView{background:currentColor}.ZStackView{display:grid;place-items:center;position:relative}.ZStackView>.VStackView{z-index:1}.AccessoryWidgetBackgroundView{position:absolute;inset:0;border-radius:50%;background:rgba(255,255,255,.12)}.light .AccessoryWidgetBackgroundView{background:rgba(0,0,0,.07)}.secondary{opacity:.78}.variants{margin-top:28px;padding-top:12px;border-top:1px solid #ffffff25}.light .variants{border-color:#00000020}.variant{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:86px;border-bottom:1px solid #ffffff12}.light .variant{border-color:#00000010}.variant>span{font-size:10px;max-width:100px;opacity:.75}.variant:last-child{border:0}
</style><h1>Todo / ロック画面</h1><p>実装したレイアウトを使ったデザイン確認用プレビュー。iOSの実画面ではなく、文字・サイズ・背景の見え方は端末で異なります。</p><div class="grid">${panel('dark')}${panel('light')}</div></html>`;
const output = path.resolve(__dirname, '../.artifacts/previews/lock-widgets.html');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, document);
console.log(output);
