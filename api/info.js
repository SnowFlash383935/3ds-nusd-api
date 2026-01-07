// api/info.js
import fetch from 'node-fetch';
import https from 'https';
const agent = new https.Agent({rejectUnauthorized:false});
const CDN = 'https://nus.cdn.c.shop.nintendowifi.net/ccs/download/';

export default async (req,res)=>{
  const {tid,ver}=req.query;
  if(!tid||!/^[0-9a-f]{16}$/i.test(tid)) return res.status(400).json({error:'bad tid'});
  const id=tid.toLowerCase();
  try{
    const tmdUrl=`${CDN}${id}/`+(ver?`tmd.${ver}`:'tmd');
    const r=await fetch(tmdUrl,{agent});
    if(!r.ok) return res.status(404).json({error:'TMD not found'});
    const buf=await r.arrayBuffer();
    const info=parseTmdMinimal(buf);
    // есть ли ticket?
    let ticket=false;
    try{ ticket=(await fetch(`${CDN}${id}/cetk`,{agent})).ok }catch{}
    res.json({tid:id, version:info.version, contentCount:info.contentCount, ticket, contents:info.contents});
  }catch(e){res.status(500).json({error:e.message})}
};

function parseTmdMinimal(buf) {
  const v = new DataView(buf);

  /* 1. длина подписи */
  const sigType = v.getUint32(0, false);
  let sigLen = 4;
  switch (sigType) {
    case 0x00010000: sigLen += 0x200 + 0x3C; break;  // RSA-4096
    case 0x00010001: sigLen += 0x100 + 0x3C; break;  // RSA-2048
    case 0x00010002: sigLen += 0x3C + 0x40; break;   // ECDSA
    default: sigLen = 0x100 + 0x3C;                  // старый без type
  }

  /* 2. заголовок (fixed 0xC4 байта) */
  const offHeader = sigLen;
  const contentCount = v.getUint16(offHeader + 0x9E, false);   // +1DE hex
  const titleVersion = v.getUint16(offHeader + 0x9C, false);   // +1DC hex

  /* 3. Content Info Records (64×0x24 = 0x900) – прыгаем */
  const offContentInfo = offHeader + 0xC4;          // +204 hex
  const offChunks = offContentInfo + 0x900;         // +B04 hex

  /* 4. читаем Content Chunk-и */
  const contents = [];
  for (let i = 0; i < contentCount; i++) {
    const off = offChunks + i * 0x30;
    const cid  = v.getUint32(off, false);
    const size = v.getBigUint64(off + 8, false);
    contents.push({cid: cid.toString(16).padStart(8,'0'), size: size.toString()});
  }

  return {titleVersion, contentCount, contents};
}
