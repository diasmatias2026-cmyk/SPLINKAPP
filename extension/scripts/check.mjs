import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
let failures=0,files=0;
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory()){if(!['dist','vendor','.taste-skill','node_modules','artifacts'].includes(item.name))walk(file);}else if(/\.(mjs|cjs|js)$/.test(file)){files++;const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status){process.stderr.write(r.stderr);failures++;}if(file.startsWith('src')&&/innerHTML\s*=|\beval\s*\(|new Function\(/.test(fs.readFileSync(file,'utf8'))){console.error('Unsafe dynamic markup/code:',file);failures++;}}}}
walk('src');walk('scripts');walk('tests');
const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));for(const file of [manifest.options_page,manifest.background.service_worker,...manifest.content_scripts.flatMap(s=>s.js),...Object.values(manifest.icons)])if(!fs.existsSync(file)){console.error('Manifest resource missing:',file);failures++;}
console.log(`${files} scripts checked; ${failures} errors.`);process.exitCode=failures?1:0;
