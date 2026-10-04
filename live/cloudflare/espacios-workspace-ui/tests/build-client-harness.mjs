/** Exact patched client surface bodies, mounted using real React. APIs prohibited. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const root=new URL('../verification',import.meta.url).pathname;
const clientPath=new URL('../assets/WorkspaceApp-E-tE3LmW.js',import.meta.url).pathname;
const src=await readFile(clientPath,'utf8');
const fn=name=>{let start=src.indexOf('function '+name+'(');if(start<0)throw Error('Missing '+name);let end=src.indexOf('function ',start+10);return src.slice(start,end<0?src.length:end);};
const bodies=['K','q','J','Y','Ni','zi','Li','Vi','Bi','Q','$','Hi','Ui','Ji','oi'].map(fn).join('\n');
const harness=`import * as w from 'react';\nimport * as D from 'react/jsx-runtime';\nimport {createRoot} from 'react-dom/client';\nimport {flushSync} from 'react-dom';\nconst i=({href,children,...props})=>w.createElement('a',{href,...props},children);\nconst X=({name})=>w.createElement('span',{'aria-hidden':'true',className:'workspace-icon'},name==='research'?'⌕':'◇');\nconst c=surface=>surface==='crm'?'/legacy/crm':'/legacy/'+surface;\nconst d=(...args)=>{window.__networkAttempts++;throw Error('No API calls authorized in fixture');};\nwindow.__networkAttempts=0;\nwindow.fetch=d;\n${bodies}\nlet root=createRoot(document.getElementById('fixture'));let fixtureKey=0;\nwindow.__mountFixture=(name,props)=>{flushSync(()=>root.render(w.createElement('div',{className:'workspace-app ecosystem-glass-v3'},w.createElement('div',{className:'workspace-content'},w.createElement(({LearnSurface:Ni,CrmSurface:zi,OpsSurface:Li})[name],{...props,key:++fixtureKey,onNotice:()=>{},onReload:()=>{throw Error('No reload authorized')}})))));};\n`;
await mkdir(root+'/client-harness',{recursive:true});
await writeFile(root+'/client-harness/extracted-surfaces.js',harness);
await build({entryPoints:[root+'/client-harness/extracted-surfaces.js'],bundle:true,platform:'browser',format:'iife',outfile:root+'/client-harness/bundle.js',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
await writeFile(root+'/client-harness/manifest.json',JSON.stringify({source:clientPath,sha256:createHash('sha256').update(src).digest('hex'),method:'Exact Learn/CRM/Ops function bodies and shared data/tab/panel helpers from patched client asset. Real React 19.2.6 events/hooks rendered locally. Only external Link/Icon helpers and route helper are isolated adapters. No WorkspaceApp/bootstrap or user sessions; fetch throws, browser network aborted.'},null,2));
console.log('Built exact client surface harness');
