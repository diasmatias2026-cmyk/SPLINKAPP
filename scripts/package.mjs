import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ZIP STORE: no external executable or install scripts required.
export function zipEntries(entries) {
  const table=Array.from({length:256},(_,value)=>{for(let i=0;i<8;i++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
  const crc=data=>{let value=0xffffffff;for(const byte of data)value=table[(value^byte)&255]^(value>>>8);return(value^0xffffffff)>>>0;};
  const local=[],central=[];let offset=0;
  for(const entry of entries){
    if(!entry.name||entry.name.startsWith('/')||entry.name.split('/').some(p=>p==='..'||!p)||entry.name.includes('\\'))throw new Error('Unsafe ZIP path.');
    const name=Buffer.from(entry.name),data=Buffer.from(entry.data),checksum=crc(data);
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(checksum,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
    const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(0x800,8);directory.writeUInt16LE(33,14);directory.writeUInt32LE(checksum,16);directory.writeUInt32LE(data.length,20);directory.writeUInt32LE(data.length,24);directory.writeUInt16LE(name.length,28);directory.writeUInt32LE(offset,42);
    local.push(header,name,data);central.push(directory,name);offset+=header.length+name.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=path.join(root,'extension/dist'),entries=[];
  function walk(relative=''){for(const item of fs.readdirSync(path.join(source,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const name=relative?`${relative}/${item.name}`:item.name;if(item.isSymbolicLink())throw new Error('Symlinks are not packaged.');if(item.isDirectory())walk(name);else entries.push({name,data:fs.readFileSync(path.join(source,name))});}}
  walk();if(!entries.some(e=>e.name==='manifest.json'))throw new Error('Build extension before packaging.');
  const output=path.join(root,'artifacts');fs.mkdirSync(output,{recursive:true});const filename='splink-zap-2.0.0.zip',bytes=zipEntries(entries);
  fs.writeFileSync(path.join(output,filename),bytes);fs.writeFileSync(path.join(output,`${filename}.sha256`),`${crypto.createHash('sha256').update(bytes).digest('hex')}  ${filename}\n`);
  console.log(`Packaged ${entries.length} files: ${path.join(output,filename)}`);
}
