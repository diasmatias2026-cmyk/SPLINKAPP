import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipEntries} from '../../scripts/package.mjs';
test('ZIP preserves binary bytes, CRC and directory offsets',()=>{
  const zip=zipEntries([{name:'manifest.json',data:Buffer.from('123456789')},{name:'assets/logo.png',data:Buffer.from([0,255,1,128])}]);
  assert.equal(zip.readUInt32LE(0),0x04034b50);assert.equal(zip.readUInt32LE(14),0xcbf43926);
  assert.equal(zip.subarray(30+13,30+13+9).toString(),'123456789');
  const end=zip.length-22,directory=zip.readUInt32LE(end+16);assert.equal(zip.readUInt32LE(directory),0x02014b50);assert.equal(zip.readUInt16LE(end+10),2);
  assert.throws(()=>zipEntries([{name:'../private',data:''}]),/Unsafe/);
});
