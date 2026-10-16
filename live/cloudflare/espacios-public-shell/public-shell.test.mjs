import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const source = await readFile(new URL('./worker.js', import.meta.url), 'utf8');
const worker = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default;
const js = await (await worker.fetch(new Request('https://espacios.me/__espacios/public-polish.js'), {})).text();
const markup = `<html><head><style>.form-submit{display:flex}</style></head><body><main><form class="proposal-form"><section class="form-section"><input id="name" required><input id="email" type="email" required></section><section class="form-section"><input id="company" required></section><section class="form-section"><textarea id="project" required></textarea></section><div class="form-submit"><input type="checkbox" required><button type="submit">Submit</button></div></form></main></body></html>`;
const response = await worker.fetch(new Request('https://espacios.me/request-proposal'), {MARKETING:{fetch:async()=>new Response(markup,{headers:{'content-type':'text/html'}})}});
const html = await response.text();
const browser = await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH} : {}),headless:true,args:['--no-sandbox']});
try {
 const page = await browser.newPage();
 await page.route('**/*', async route => {
  if(route.request().url().endsWith('/__espacios/public-polish.js')) await route.fulfill({contentType:'application/javascript',body:js});
  else await route.fulfill({contentType:'text/html',body:html});
 });
 await page.addInitScript(()=>localStorage.setItem('espacios_theme_v1','dark'));
 await page.goto('https://espacios.me/request-proposal');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.espaciosTheme),'dark');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
 await page.evaluate(()=>{delete document.documentElement.dataset.espaciosTheme;delete document.documentElement.dataset.theme;});
 await page.waitForFunction(()=>document.documentElement.dataset.espaciosTheme==='dark'&&document.documentElement.dataset.theme==='dark');
 await page.evaluate(()=>{localStorage.setItem('espacios_theme_v1','light');window.dispatchEvent(new CustomEvent('espacios-theme-change'));});
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.espaciosTheme),'light');
 await page.getByText('Continue to project details').waitFor();
 assert.equal(await page.locator('.form-submit').isVisible(),false);
 assert.equal(await page.locator('#project').isVisible(),false);
 await page.getByText('Continue to project details').click();
 assert.equal(await page.locator('#project').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'name');
 await page.locator('#name').fill('Test');
 await page.locator('#email').fill('invalid');
 await page.locator('#company').fill('Test company');
 await page.getByText('Continue to project details').click();
 assert.equal(await page.locator('#project').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'email');
 await page.locator('#email').fill('test@example.com');
 await page.getByText('Continue to project details').click();
 assert.equal(await page.locator('#project').isVisible(),true);
 assert.equal(await page.locator('.form-submit').isVisible(),true);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'project');
 const workspaceMarkup='<html><head></head><body><main><div class="workspace-overview-page"><section class="workspace-overview-core"><div class="workspace-module-grid" style="display:grid;grid-template-columns:repeat(3,1fr)">'+Array.from({length:6},()=>'<article>Tool</article>').join('')+'</div></section></div></main></body></html>';
 const workspaceHtml=await (await worker.fetch(new Request('https://espacios.me/workspace'),{MARKETING:{fetch:async()=>new Response(workspaceMarkup,{headers:{'content-type':'text/html'}})}})).text();
 // The fixture's inline grid models a stronger rule than production; remove it for layout checks.
 await page.setContent(workspaceHtml.replace('style="display:grid;grid-template-columns:repeat(3,1fr)"','style="display:grid"'));
 for(const [width,columns] of [[1440,4],[800,2],[390,1]]) {
  await page.setViewportSize({width,height:900});
  assert.equal(await page.locator('.workspace-module-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),columns);
 }
 assert.equal(await page.locator('.workspace-module-grid article:visible').count(),4);
 console.log('PASS: proposal validation/focus/visibility, saved theme/hydration, and Workspace 4/2/1 preview');
} finally {await browser.close();}
