import fetch from 'node-fetch';
import https from 'https';
import archiver from 'archiver';
import {Buffer} from 'buffer';

const CDN = 'https://nus.cdn.c.shop.nintendowifi.net/ccs/download/';
const agent = new https.Agent({ rejectUnauthorized: false });

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const {tid, ver} = req.query;
  if (!tid || !/^[0-9a-f]{16}$/i.test(tid))
    return res.status(400).json({error: 'tid must be 16-hex'});
  const id = tid.toLowerCase();

  try {
    const tmdUrl = `${CDN}${id}/` + (ver ? `tmd.${ver}` : 'tmd');
    const tmdBuf = await fetch(tmdUrl, {agent}).then(r => {
      if (!r.ok) throw new Error('TMD not found');
      return r.arrayBuffer();
    });
    const contents = parseTmd(tmdBuf);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition',
      `attachment; filename="${id}${ver ? '-v' + ver : ''}.zip"`);

    const archive = archiver('zip', {store: false});
    archive.on('error', e => { throw e; });
    archive.pipe(res);

    archive.append(Buffer.from(tmdBuf), {name: `${id}-tmd`});

    let cetkBuf = null;
    try {
      cetkBuf = await fetch(`${CDN}${id}/cetk`, {agent})
                 .then(r => r.ok ? r.arrayBuffer() : null);
      if (cetkBuf) archive.append(Buffer.from(cetkBuf), {name: `${id}-cetk`});
    } catch(e) {}

    for (const c of contents) {
      const url = `${CDN}${id}/${c.cid}`;
      const resp = await fetch(url, {agent});
      if (!resp.ok) throw new Error(`Content ${c.cid} not found`);
      archive.append(resp.body, {name: `${id}-${c.cid}.app`});
    }

    await archive.finalize();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({error: e.message || e.toString()});
  }
};

function parseTmd(buf) {
  const view = new DataView(buf);
  const sigType = view.getUint32(0, false);
  let sigLen = 4;
  switch (sigType) {
    case 0x00010000: sigLen += 0x200 + 0x3C; break;
    case 0x00010001: sigLen += 0x100 + 0x3C; break;
    case 0x00010002: sigLen += 0x3C + 0x40; break;
    default: sigLen = 0x100 + 0x3C;
  }
  const offHeader = sigLen;
  const contentCount = view.getUint16(offHeader + 0x9E, false);
  const contentInfoCount = view.getUint16(offHeader + 0xA0, false);
  let off = offHeader + 0xC4 + contentInfoCount * 0x24;
  const contents = [];
  for (let i = 0; i < contentCount; i++) {
    const cid = view.getUint32(off, false);
    const size = view.getBigUint64(off + 8, false);
    contents.push({cid: cid.toString(16).padStart(8, '0'), size});
    off += 0x30;
  }
  return contents;
}
    /* 3. Добавляем файлы */
    archive.append(Buffer.from(tmdBuf), {name: `${id}-tmd`});

    let cetkBuf = null;
    try {
      cetkBuf = await fetch(`${CDN}${id}/cetk`, {agent})
        .then(r => r.ok ? r.arrayBuffer() : null);
      if (cetkBuf) archive.append(Buffer.from(cetkBuf), {name: `${id}-cetk`});
    } catch {}

    for (const c of contents) {
      const url = `${CDN}${id}/${c.cid}`;
      const resp = await fetch(url, {agent});
      if (!resp.ok) throw new Error(`Content ${c.cid} not found`);
      /* качаем стримом сразу в архив */
      archive.append(resp.body, {name: `${id}-${c.cid}.app`, size: Number(c.size)});
    }

    /* 4. Завершаем */
    await archive.finalize();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({error: e.message || e.toString()});
  }
};

/* ---------- парсер TMD (без изменений) ---------- */
function parseTmd(buf) {
  const view = new DataView(buf);
  const sigType = view.getUint32(0, false);
  let sigLen = 4;
  switch (sigType) {
    case 0x00010000: sigLen += 0x200 + 0x3C; break;
    case 0x00010001: sigLen += 0x100 + 0x3C; break;
    case 0x00010002: sigLen += 0x3C + 0x40; break;
    default: sigLen = 0x100 + 0x3C; // старая без type
  }
  const offHeader = sigLen;
  const contentCount = view.getUint16(offHeader + 0x9E, false);
  const contentInfoCount = view.getUint16(offHeader + 0xA0, false);
  let off = offHeader + 0xC4 + contentInfoCount * 0x24;
  const contents = [];
  for (let i = 0; i < contentCount; i++) {
    const cid = view.getUint32(off, false);
    const size = view.getBigUint64(off + 8, false);
    contents.push({cid: cid.toString(16).padStart(8, '0'), size});
    off += 0x30;
  }
  return contents;
}
    let cetkBuf = null;
    try {
      cetkBuf = await fetch(`${CDN}${id}/cetk`, { agent }).then(r => r.ok ? r.arrayBuffer() : null);
      if (cetkBuf) await zip.addBuffer(Buffer.from(cetkBuf), `${id}-cetk`);
    } catch {}

    for (const c of contents) {
      const url = `${CDN}${id}/${c.cid}`;
      const resp = await fetch(url, { agent });
      if (!resp.ok) throw new Error(`Content ${c.cid} not found`);
      
      const stream = resp.body;
      await zip.addStream(stream, `${id}-${c.cid}.app`, {size: Number(c.size)});
    }
    
    await zip.end();
  } catch (e) {
    res.status(500).json({error: e.message || e.toString()});
  }
};

function parseTmd(buf) {
  const view = new DataView(buf);

  // 1. определяем длину подписи
  const sigType = view.getUint32(0, false);
  let sigLen = 4; // 4 байта type
  switch (sigType) {
    case 0x00010000: sigLen += 0x200 + 0x3C; break; // RSA-4096
    case 0x00010001: sigLen += 0x100 + 0x3C; break; // RSA-2048
    case 0x00010002: sigLen += 0x3C + 0x40; break;  // ECDSA
    default:
      // старая подпись без type – сразу 0x100 + 0x3C
      sigLen = 0x100 + 0x3C;
  }

  // 2. читаем заголовок
  const offHeader = sigLen;
  const contentCount = view.getUint16(offHeader + 0x9E, false);
  const contentInfoCount = view.getUint16(offHeader + 0xA0, false);

  // 3. прыгаем к ContentChunk-ам
  let off = offHeader + 0xC4 + contentInfoCount * 0x24;

  const contents = [];
  for (let i = 0; i < contentCount; i++) {
    const cid  = view.getUint32(off, false);
    const size = view.getBigUint64(off + 8, false);
    contents.push({cid: cid.toString(16).padStart(8, '0'), size});
    off += 0x30;
  }
  return contents;
}

