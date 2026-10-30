// Render marketing layouts around unmodified native screenshots. No generated UI.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const img = file => `data:image/png;base64,${fs.readFileSync(path.join(root, file)).toString('base64')}`;
const panels = [
 { file:'01-lock-screen.png', label:'LOCK SCREEN', title:'開かず、わかる。', subtitle:'今日の件数と、次のタスクをロック画面に。', source:'screenshots/raw/lock-screen.png', type:'phone', theme:'dark' },
 { file:'02-home-widget.png', label:'HOME WIDGET', title:'大切なことを、\nホーム画面に。', subtitle:'優先タスクと期限を、ひと目で確認。', source:'screenshots/raw/home-widget.png', type:'widget', theme:'dark' },
 { file:'03-priorities.png', label:'FOUR PRIORITIES', title:'やることに、\n優先順位を。', subtitle:'緊急度と重要度で、すっきり4分類。', source:'screenshots/raw/priority-list.png', type:'phone', theme:'light' },
 { file:'04-reminder.png', label:'REMINDER', title:'予定の前に、\nひと知らせ。', subtitle:'10分前・30分前・1時間前をワンタップ。', source:'screenshots/raw/reminder.png', type:'phone', theme:'light' },
];
function html(panel, i) {
 const dark=panel.theme==='dark';
 return `<!doctype html><html lang="ja"><meta charset="utf-8"><style>
 *{box-sizing:border-box} html,body{margin:0;width:1320px;height:2868px;overflow:hidden} body{font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif;background:${dark?'#151916':'#f1f1e9'};color:${dark?'#f5f6ee':'#202b21'}}
 .brand{position:absolute;top:100px;left:98px;right:98px;display:flex;align-items:center;gap:22px;font-size:38px;font-weight:600}.brand img{width:64px;height:64px;border-radius:16px}.number{margin-left:auto;color:${dark?'#909b90':'#777e71'};font-size:28px;font-weight:500}
 .label{position:absolute;left:100px;top:238px;font-size:28px;font-weight:600;letter-spacing:6px;color:${dark?'#d0e6a5':'#566f32'}}
 h1{position:absolute;left:92px;top:300px;margin:0;font-size:110px;line-height:1.32;letter-spacing:-5px;font-weight:700;white-space:pre-line} .sub{position:absolute;left:98px;top:${panel.title.includes('\n')?640:500}px;margin:0;font-size:38px;line-height:1.6;letter-spacing:-1px;color:${dark?'#b7c2b4':'#65715e'}}
 .phone{position:absolute;left:145px;top:${panel.title.includes('\n')?805:690}px;width:1030px;border:12px solid ${dark?'#42493f':'#cdd3c3'};border-radius:110px;overflow:hidden;box-shadow:0 35px 100px #0003;background:#000}.phone img{display:block;width:100%;height:auto}
 .widget{position:absolute;left:98px;right:98px;top:950px;padding:0;border-radius:65px;overflow:hidden;box-shadow:0 32px 90px #0005}.widget img{display:block;width:100%}
 .foot{position:absolute;left:100px;top:1820px;font-size:72px;line-height:1.8;font-weight:600;letter-spacing:-2px;color:#d0e6a5}.detail{font-size:36px;color:#aebbab;font-weight:400;letter-spacing:0;line-height:1.8;margin-top:36px}.rule{position:absolute;left:100px;right:100px;bottom:130px;height:1px;background:${dark?'#3c4639':'#d4d8cc'}}
 .lock .phone{width:790px;left:265px;top:690px;border-radius:86px}.zoom-label{position:absolute;top:2190px;left:100px;color:#c8d3c2;font-size:28px;letter-spacing:2px}.zoom{position:absolute;top:2260px;left:98px;width:1124px;border:2px solid #56604f;border-radius:36px;overflow:hidden;box-shadow:0 25px 70px #0006}.zoom img{width:100%;display:block}
 </style><body class="${i===0?'lock':''}"><div class="brand"><img src="${img('../assets/icon-cool.png')}">Todo<span class="number">0${i+1} / 04</span></div><div class="label">${panel.label}</div><h1>${panel.title}</h1><p class="sub">${panel.subtitle}</p><div class="${panel.type}"><img src="${img(panel.source)}"></div>${panel.type==='widget'?'<div class="foot">小・中・大の3サイズ。<br>自分に合う情報量で。<div class="detail">タスクをタップすると、編集画面へ。<br>※ 小サイズは一覧を開きます。</div></div>':''}${panel.type==='widget'?'<div class="rule"></div>':''}${i===0?`<div class="zoom-label">ウィジェットを拡大</div><div class="zoom"><img src="${img('screenshots/raw/lock-widget-detail.png')}"></div>`:''}</body></html>`;
}
(async()=>{
 const browser=await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH});
 const page=await browser.newPage({viewport:{width:1320,height:2868},deviceScaleFactor:1});
 const out=path.join(root,'screenshots/ja-JP');fs.mkdirSync(out,{recursive:true});
 for(const [i,panel] of panels.entries()){
  if(!fs.existsSync(path.join(root,panel.source))) throw Error('Missing native screenshot: '+panel.source);
  await page.setContent(html(panel,i));await page.evaluate(()=>document.fonts.ready);await page.locator('img').evaluateAll(els=>Promise.all(els.map(el=>el.decode())));
  await page.screenshot({path:path.join(out,panel.file),type:'png'});console.log(panel.file);
 }
 await page.setViewportSize({width:1760,height:1020});
 const previews=panels.map(p=>`<img src="${img('screenshots/ja-JP/'+p.file)}" style="width:396px;height:860.4px;border-radius:24px">`).join('');
 await page.setContent(`<body style="margin:0;background:#e9eae3;display:flex;gap:28px;padding:60px 46px">${previews}</body>`);
 await page.screenshot({path:path.join(root,'screenshots/overview.png')});
 await browser.close();
})();
