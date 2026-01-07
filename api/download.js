import fetch from 'node-fetch';
import {PassThrough} from 'stream';
import yauzl from 'yauzl-promise';
import {Buffer} from 'buffer';
import https from 'https';

// один агент на весь модуль
const agent = new https.Agent({ rejectUnauthorized: false });

const CDN = 'https://nus.cdn.c.shop.nintendowifi.net/ccs/download/';

export default async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const {tid, ver} = req.query;
  if (!tid || !/^[0-9a-f]{16}$/i.test(tid))
    return res.status(400).json({error: 'tid must be 16-hex'});
  const id = tid.toLowerCase();

  try {
    /* ---------- 1. TMD ---------- */
    const tmdUrl = `${CDN}${id}/` + (ver ? `tmd.${ver}` : 'tmd');
    const tmdBuf = await fetch(tmdUrl, {agent}).then(r => {
      if (!r.ok) throw new Error('TMD not found');
      return r.arrayBuffer();
    });

    /* ---------- 2. Ticket ---------- */
    let cetkBuf = null;
    try {
      cetkBuf = await fetch(`${CDN}${id}/cetk`, {agent}).then(r => r.ok ? r.arrayBuffer() : null);
    } catch {}
    console.log('sigLen', sigLen,
            'contentCount', contentCount,
            'contentInfoCount', contentInfoCount);
    /* ---------- 3. Контенты ---------- */
    const contents = parseTmd(tmdBuf); // [{cid,size},…]

    /* ---------- 4. Формируем ZIP на лету ---------- */
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${id}${ver ? '-v'+ver : ''}.zip"`);

    const zip = new yauzl.ZipWriter(new PassThrough());
    zip.pipe(res); // сразу в ответ

    await zip.addBuffer(Buffer.from(tmdBuf), `${id}-tmd`);
    if (cetkBuf) await zip.addBuffer(Buffer.from(cetkBuf), `${id}-cetk`);

    for (const c of contents) {
      const url = `${CDN}${id}/${c.cid}`;
      const stream = (await fetch(url, {agent})).body;
      await zip.addStream(stream, `${id}-${c.cid}.app`, {size: c.size});
    }
    await zip.end();
  } catch (e) {
    res.status(500).json({error: e.message || e});
  }
};

/* ---------- простейший TMD-парсер ---------- */
function parseTmd(buf) {
  const view = new DataView(buf);
  const sigLen = 4 + view.getUint32(0, false); // длина подписи
  const offHeader = sigLen;                    // начало заголовка

  const contentCount     = view.getUint16(offHeader + 0x9E, false);
  const contentInfoCount = view.getUint16(offHeader + 0xA0, false);

  let off = offHeader + 0xC4;                  // пропускаем header
  off += contentInfoCount * 0x24;              // пропускаем ContentInfo

  const arr = [];
  for (let i = 0; i < contentCount; i++) {
    const cid  = view.getUint32(off, false);
    const size = view.getBigUint64(off + 8, false);
    arr.push({cid: cid.toString(16).padStart(8, '0'), size});
    off += 0x30;
  }
  return arr;
}
