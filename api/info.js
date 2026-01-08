// api/info.js
import fetch from 'node-fetch';
import https from 'https';
const agent = new https.Agent({ rejectUnauthorized: false });
const CDN = 'https://nus.cdn.c.shop.nintendowifi.net/ccs/download/';

export default async (req, res) => {
  const { tid, ver } = req.query;
  if (!tid || !/^[0-9a-f]{16}$/i.test(tid)) return res.status(400).json({ error: 'bad tid' });
  const id = tid.toLowerCase();
  try {
    const tmdUrl = `${CDN}${id}/` + (ver ? `tmd.${ver}` : 'tmd');
    const r = await fetch(tmdUrl, { agent });
    if (!r.ok) return res.status(404).json({ error: 'TMD not found' });
    const buf = await r.arrayBuffer();
    const info = parseTmdFull(buf);
    // есть ли ticket?
    let ticket = false;
    try { ticket = (await fetch(`${CDN}${id}/cetk`, { agent })).ok } catch { }
    res.json({ tid: id, version: info.version, contentCount: info.contentCount, ticket, contents: info.contents });
  } catch (e) { res.status(500).json({ error: e.message }) };
};

/**
 * @typedef {{ cid: string, index: number, type: number, size: string, hash: string }} ContentRecord
 * @param {ArrayBuffer} buffer
 * @returns {{ titleId: string, titleType: number, saveDataSize: number, accessRights: number, version: number, contentCount: number, contentInfoHash: string, contents: ContentRecord[] }}
 */
function parseTmdFull(buffer) {
  const view = new DataView(buffer);
  let offset = 0;

  // === 1. Подпись ===
  const signatureType = view.getUint32(offset, false); offset += 4;
  let signatureLength = 0;

  switch (signatureType) {
    case 0x00010000: signatureLength = 0x200; break; // RSA-4096
    case 0x00010001: signatureLength = 0x100; break; // RSA-2048
    case 0x00010002: signatureLength = 0x3C; break;  // ECDSA
    default: throw new Error("Unknown signature type");
  }

  // Пропускаем подпись и выравнивание
  offset += signatureLength + 0x3C;

  // === 2. Заголовок ===
  const issuer = getString(view, offset, 0x40); offset += 0x40;
  const version = view.getUint8(offset); offset += 1;
  offset += 0xB; // reserved / unknown
  const titleId = getHex(view, offset, 8); offset += 8;
  const titleType = view.getUint32(offset, false); offset += 4;
  offset += 2; // padding
  const saveDataSize = view.getUint32(offset, false); offset += 4;
  offset += 0x3E; // skip to access rights
  const accessRights = view.getUint32(offset, false); offset += 4;
  const titleVersion = view.getUint16(offset, false); offset += 2;
  const contentCount = view.getUint16(offset, false); offset += 2;
  offset += 10; // padding
  const contentInfoHash = getHex(view, offset, 20); offset += 20;

  // === 3. Content Info Records (пропускаем, используется только первая запись) ===
  offset += 64 * 0x24; // 64 records of 0x24 bytes each

  // === 4. Content Chunk Records ===
  /** @type {ContentRecord[]} */
  const contents = [];

  for (let i = 0; i < contentCount; i++) {
    const cid = getHex(view, offset, 4); offset += 4;
    const index = view.getUint16(offset, false); offset += 2;
    const type = view.getUint16(offset, false); offset += 2;
    const size = view.getBigUint64(offset, false).toString(); offset += 8;
    const hash = getHex(view, offset, 20); offset += 20;
    contents.push({ cid, index, type, size, hash });
  }

  return {
    titleId,
    titleType,
    saveDataSize,
    accessRights,
    version: titleVersion,
    contentCount,
    contentInfoHash,
    contents
  };
}

/**
 * Читает строку до первого нулевого байта
 * @param {DataView} view
 * @param {number} byteOffset
 * @param {number} maxLength
 * @returns {string}
 */
function getString(view, byteOffset, maxLength) {
  const chars = [];
  for (let i = 0; i < maxLength; i++) {
    const charCode = view.getUint8(byteOffset + i);
    if (charCode === 0) break;
    chars.push(String.fromCharCode(charCode));
  }
  return chars.join('');
}

/**
 * Преобразует байты в HEX строку
 * @param {DataView} view
 * @param {number} byteOffset
 * @param {number} length
 * @returns {string}
 */
function getHex(view, byteOffset, length) {
  const bytes = [];
  for (let i = 0; i < length; i++) {
    bytes.push(view.getUint8(byteOffset + i).toString(16).padStart(2, '0'));
  }
  return bytes.join('');
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
