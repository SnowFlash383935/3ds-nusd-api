import fetch from 'node-fetch';
import {PassThrough} from 'stream';
import yauzl from 'yauzl-promise';
import {Buffer} from 'buffer';

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
    const tmdBuf = await fetch(tmdUrl).then(r => {
      if (!r.ok) throw new Error('TMD not found');
      return r.arrayBuffer();
    });

    /* ---------- 2. Ticket ---------- */
    let cetkBuf = null;
    try {
      cetkBuf = await fetch(`${CDN}${id}/cetk`).then(r => r.ok ? r.arrayBuffer() : null);
    } catch {}

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
      const stream = (await fetch(url)).body;
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
  let off = 0x04 + view.getUint32(0, false); // skip sig
  off += 0xC4; // header
  off += 64 * 0x24; // skip ContentInfo
  const cnt = view.getUint16(off - 0x2E, false);
  const arr = [];
  for (let i = 0; i < cnt; i++) {
    const cid = view.getUint32(off, false);
    const size = view.getBigUint64(off + 8, false);
    arr.push({cid: cid.toString(16).padStart(8, '0'), size});
    off += 0x30;
  }
  return arr;
}
