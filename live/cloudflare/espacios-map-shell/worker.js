
function esc(s){return String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function setMeta(html,kind,key,value){
  const attr=kind==="property"?"property":"name";
  const re=new RegExp('(<meta[^>]*'+attr+'=["\']'+key+'["\'][^>]*content=["\'])([^"\']*)(["\'][^>]*>)','i');
  return re.test(html)?html.replace(re,'$1'+esc(value)+'$3'):html.replace('</head>','<meta '+attr+'="'+key+'" content="'+esc(value)+'"></head>');
}
function mapHtml(html){
  html=html.replace(/<title>[^<]*<\/title>/i,'<title>Espacios Map · UAE Real Estate Intelligence</title>');
  html=setMeta(html,"name","description","UAE real estate and spatial intelligence across projects, communities, developers, infrastructure, market layers and future growth.");
  html=setMeta(html,"name","robots","index, follow, max-image-preview:large");
  html=setMeta(html,"property","og:title","Espacios Map · UAE Real Estate Intelligence");
  html=setMeta(html,"property","og:description","Explore UAE projects, communities, developers, infrastructure and market intelligence in one spatial interface.");
  html=setMeta(html,"property","og:url","https://espacios.me/map");
  html=setMeta(html,"name","twitter:title","Espacios Map · UAE Real Estate Intelligence");
  html=setMeta(html,"name","twitter:description","Explore UAE projects, communities, developers, infrastructure and market intelligence in one spatial interface.");
  if(!/rel=["']canonical["']/i.test(html))html=html.replace("</head>",'<link rel="canonical" href="https://espacios.me/map"></head>');
  let seen=false;
  html=html.replace(/<script id=["']espacios-theme-bootstrap["'][^>]*>[\s\S]*?<\/script>/gi,function(m){if(seen)return"";seen=true;return m;});
  return html;
}
async function forward(env,request,targetPath){
  const u=new URL(request.url);u.pathname=targetPath;
  return env.MAP.fetch(new Request(u.toString(),request));
}
export default {
  async fetch(request,env){
    const u=new URL(request.url), p=u.pathname;
    if(p==="/map/api/v1/status")return new Response(JSON.stringify({ok:true,version:"v1",product:"Espacios Map",endpoints:{core:"/map/api/v1/core",data:"/map/api/v1/data",verification:"/map/api/v1/verification"}}),{headers:{"content-type":"application/json;charset=utf-8","cache-control":"public,max-age=60"}});
    if(p==="/map/api/v1/core")return forward(env,request,"/map/map-core.json");
    if(p==="/map/api/v1/data")return forward(env,request,"/map/map-data.json");
    if(p==="/map/api/v1/verification")return forward(env,request,"/map/verification.json");
    const upstream=await env.MAP.fetch(request);
    const ct=upstream.headers.get("content-type")||"";
    if(!ct.includes("text/html")||request.method==="HEAD")return upstream;
    let html=mapHtml(await upstream.text());
    const h=new Headers(upstream.headers);h.delete("content-length");h.set("x-espacios-map-shell","v1");
    return new Response(html,{status:upstream.status,statusText:upstream.statusText,headers:h});
  }
};
