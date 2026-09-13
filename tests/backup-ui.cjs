/* Real UI/file roundtrip in disposable profiles, with fake auth and no external requests. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fake=`window.supabase={createClient(){return {auth:{onAuthStateChange(){},async getSession(){return {data:{session:{user:{id:'fictitious-A',email:'test@example.invalid'}}}}}},rpc(){return {abortSignal:async()=>({data:{records:[],accepted:[],conflicts:{}}})}}}}};`;
const allowed=new Set(['index.html','auth.js','sync-store.js','backup.js','config.js','sw.js','about.js','manifest.json','logo.png','vendor/supabase.js']);
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname.slice(1)||'index.html';if(!allowed.has(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.html')?'text/html':'application/octet-stream');res.end(name==='vendor/supabase.js'?fake:fs.readFileSync(path.join(root,name)));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH});const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'finance-backup-test-'));
try{
 const first=await browser.newContext(),second=await browser.newContext();const a=await first.newPage(),b=await second.newPage();
 for(const p of [a,b]){await p.route('https://**/*',route=>route.abort());p.on('dialog',d=>d.accept());await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForFunction(()=>unlocked);}
 await first.setOffline(true);await second.setOffline(true);
 await a.evaluate(async()=>{data.push({id:'backup-ui',valor:23.45,descricao:'FICTICIO BACKUP',categoria:'Outros',data:'2026-09-12',tipo:'entrada',controle:'pessoal',status:'pago'});await save();});
 const original=await a.evaluate(()=>FinanceStore.read('fictitious-A'));
 await a.getByRole('button',{name:'☁️ Sincronizar',exact:true}).click();await a.locator('#backupPassword').fill('Senha-Ficticia-Backup-2026!');
 const download=a.waitForEvent('download');await a.getByRole('button',{name:'Baixar backup protegido',exact:true}).click();const file=path.join(tmp,'backup.json');await (await download).saveAs(file);
 assert.ok(!fs.readFileSync(file,'utf8').includes('FICTICIO BACKUP'));
 await b.getByRole('button',{name:'☁️ Sincronizar',exact:true}).click();await b.locator('#backupFile').setInputFiles(file);await b.locator('#backupPassword').fill('Senha-Incorreta-2026!');await b.getByRole('button',{name:'Restaurar backup protegido',exact:true}).click();await b.waitForFunction(()=>document.getElementById('backupResult').textContent.includes('Não foi possível abrir'));
 assert.equal((await b.evaluate(()=>FinanceStore.read('fictitious-A'))).records.length,0);
 await b.locator('#backupFile').setInputFiles(file);await b.locator('#backupPassword').fill('Senha-Ficticia-Backup-2026!');await b.getByRole('button',{name:'Restaurar backup protegido',exact:true}).click();await b.waitForFunction(()=>document.getElementById('backupResult').textContent.includes('Backup restaurado'));
 assert.deepEqual(await b.evaluate(()=>FinanceStore.read('fictitious-A')),original);
 await b.locator('#backupFile').setInputFiles(file);await b.locator('#backupPassword').fill('Senha-Ficticia-Backup-2026!');await b.getByRole('button',{name:'Restaurar backup protegido',exact:true}).click();await b.waitForFunction(()=>document.getElementById('backupResult').textContent.includes('Backup restaurado'));
 assert.deepEqual(await b.evaluate(()=>FinanceStore.read('fictitious-A')),original);
 console.log('PASS: encrypted download, wrong-password rejection, actual file restore preserves pending operation, repeated restore is idempotent.');
}finally{await browser.close();server.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
