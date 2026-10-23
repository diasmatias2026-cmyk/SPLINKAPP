import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const check=spawnSync(process.execPath,['scripts/check.mjs'],{stdio:'inherit'});if(check.status)process.exit(check.status);
fs.mkdirSync('dist',{recursive:true});
const files=[];
function copy(source,target){const stat=fs.statSync(source);if(stat.isDirectory()){fs.mkdirSync(target,{recursive:true});for(const f of fs.readdirSync(source))copy(path.join(source,f),path.join(target,f));}else{fs.copyFileSync(source,target);files.push({file:target.replaceAll('\\','/').replace(/^dist\//,''),bytes:stat.size,sha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')});}}
for(const item of ['manifest.json','dashboard.html','src','assets','vendor','THIRD-PARTY-NOTICES.md'])copy(item,path.join('dist',item));
fs.writeFileSync('dist/build-info.json',JSON.stringify({name:'splink-extension',version:'2.0.0',builtAt:new Date().toISOString(),files},null,2));
console.log(`Built ${files.length} files into ${path.resolve('dist')}`);
