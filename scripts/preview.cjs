/* Local preview only: no repository metadata, tests, or secrets are served. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const allowed=new Set(['index.html','logo.png','manifest.json','config.js','auth.js','about.js','sync-store.js','sw.js','vendor/supabase.js']);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.json':'application/json'};
const port=Number(process.env.PORT||4173);
http.createServer((req,res)=>{
  let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';}catch(e){res.writeHead(400);res.end();return;}
  if(!['GET','HEAD'].includes(req.method)||!allowed.has(name)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');
  if(req.method==='HEAD'){res.end();return;}
  fs.createReadStream(path.join(root,name)).on('error',()=>{res.destroy();}).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log('Prévia local: http://127.0.0.1:'+port+'/ — configurar Supabase de testes antes do login.'));
