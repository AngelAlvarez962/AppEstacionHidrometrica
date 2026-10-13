// Rasterize the two curves from public/marca.svg without extra dependencies.
import {deflateSync} from 'node:zlib';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const size=256,scale=size/48;
const curves=[[10,20,15,12,22,28,28,20],[28,20,34,12,37,18,38,16],[10,30,15,22,22,38,28,30],[28,30,34,22,37,28,38,26]];
const points=curves.flatMap(c=>Array.from({length:181},(_,i)=>{const t=i/180,u=1-t;return [u*u*u*c[0]+3*u*u*t*c[2]+3*u*t*t*c[4]+t*t*t*c[6],u*u*u*c[1]+3*u*u*t*c[3]+3*u*t*t*c[5]+t*t*t*c[7]]}));
const raw=Buffer.alloc(size*(1+size*4));
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const px=(x+.5)/scale,py=(y+.5)/scale,dx=Math.max(14-px,0,px-34),dy=Math.max(14-py,0,py-34),inside=dx*dx+dy*dy<=196;
  const white=inside&&points.some(([a,b])=>(px-a)**2+(py-b)**2<=2.25);
  const off=y*(1+size*4)+1+x*4;raw.set(white?[255,255,255,255]:inside?[0,134,166,255]:[0,0,0,0],off);
}
function crc(buffer){let c=0xffffffff;for(const b of buffer){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0;}
function chunk(type,data){const tag=Buffer.from(type),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([tag,data])));return Buffer.concat([len,tag,data,sum]);}
const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
await writeFile(fileURLToPath(new URL('./icon.png',import.meta.url)),png);
await writeFile(fileURLToPath(new URL('./icon.ico',import.meta.url)),Buffer.concat([ico,png]));
