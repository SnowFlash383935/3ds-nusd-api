// api/info.js
import fetch from 'node-fetch';
import https from 'https';

const CDN = 'https://nus.cdn.c.shop.nintendowifi.net/ccs/download/';
const agent = new https.Agent({ rejectUnauthorized: false });

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { tid, ver } = req.query;
  
  if (!tid || !/^[0-9a-f]{16}$/i.test(tid)) {
    return res.status(400).json({ error: 'tid must be 16-hex' });
  }
  
  const id = tid.toLowerCase();

  try {
    // Получаем TMD
    const tmdUrl = `${CDN}${id}/` + (ver ? `tmd.${ver}` : 'tmd');
    const tmdResponse = await fetch(tmdUrl, { agent });
    
    if (!tmdResponse.ok) {
      return res.status(404).json({ error: 'TMD not found' });
    }
    
    const tmdBuf = await tmdResponse.arrayBuffer();
    const tmdInfo = parseTmd(new Uint8Array(tmdBuf));
    
    // Пытаемся получить CETK
    let cetkInfo = null;
    try {
      const cetkResponse = await fetch(`${CDN}${id}/cetk`, { agent });
      if (cetkResponse.ok) {
        const cetkBuf = await cetkResponse.arrayBuffer();
        cetkInfo = parseCetk(new Uint8Array(cetkBuf));
      }
    } catch (e) {
      // CETK не обязателен
    }
    
    // Парсим TID
    const tidInfo = parseTid(id);
    
    // Возвращаем полную информацию
    res.status(200).json({
      tid: id,
      tmd: tmdInfo,
      cetk: cetkInfo,
      title: tidInfo
    });
  } catch (e) {
    console.error('Error processing request:', e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }
};

function parseTid(tid) {
  // Преобразуем TID в верхний регистр
  const normalizedTid = tid.toUpperCase();
  
  // Разбор структуры TID
  const type = normalizedTid.substring(0, 8);
  const uniqueId = normalizedTid.substring(8, 12);
  const variant = normalizedTid.substring(12, 16);
  
  // Разбор поля Variant
  const flags = variant.substring(0, 2); // Старший байт
  const regionCodeHex = variant.substring(2, 4); // Младший байт
  const regionCode = parseInt(regionCodeHex, 16);
  
  // Определение типа контента
  let category = 'Unknown';
  let typeDescription = 'Unknown';
  
  const typeMap = {
    '00040000': { category: 'Application', description: 'Game/Application' },
    '00040001': { category: 'System Application', description: 'System Software' },
    '00040002': { category: 'DLP Child', description: 'Download Play Content' },
    '0004000E': { category: 'Update', description: 'System Update' },
    '00040010': { category: 'System Data Archive', description: 'Essential System Data' },
    '0004001B': { category: 'Shared Data Archive', description: 'Shared System Data' },
    '00040030': { category: 'Applet', description: 'System Applet' },
    '00040080': { category: 'Firmware', description: 'Firmware Package' },
    '0004008C': { category: 'DLC', description: 'Downloadable Content' },
    '000400DB': { category: 'Demo', description: 'Demo Version' }
  };
  
  if (typeMap[type]) {
    category = typeMap[type].category;
    typeDescription = typeMap[type].description;
  }
  
  return {
    value: normalizedTid,
    structure: {
      type: {
        value: type,
        category: category,
        description: typeDescription
      },
      uniqueId: {
        value: uniqueId,
        decimal: parseInt(uniqueId, 16)
      },
      variant: {
        value: variant,
        flags: {
          value: flags,
          decimal: parseInt(flags, 16)
        }
      }
    }
  };
}

function parseTmd(buffer) {
  if (buffer.length < 0x140) {
    throw new Error('Invalid TMD buffer size');
  }
  
  // Определение длины сигнатуры
  const sigType = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3];
  
  let sigLen = 4;
  switch (sigType) {
    case 0x00010000: // RSA-2048
      sigLen += 0x200 + 0x3C;
      break;
    case 0x00010001: // RSA-1024
      sigLen += 0x100 + 0x3C;
      break;
    case 0x00010002: // Elliptic Curve
      sigLen += 0x3C + 0x40;
      break;
    case 0x00010003: // RSA-4096
      sigLen += 0x400 + 0x3C;
      break;
    default:
      sigLen = 0x140; // По умолчанию RSA-2048
  }
  
  const offHeader = sigLen;
  
  // Проверка, что буфер достаточно большой
  if (buffer.length < offHeader + 0x9C + 8) {
    throw new Error('TMD buffer too small');
  }
  
  // Извлечение информации из заголовка TMD
  let issuer = '';
  for (let i = 0; i < 0x40 && buffer[offHeader + i] !== 0; i++) {
    issuer += String.fromCharCode(buffer[offHeader + i]);
  }
  
  const version = buffer[offHeader + 0x40];
  const caCrlVersion = buffer[offHeader + 0x41];
  const signerCrlVersion = buffer[offHeader + 0x42];
  
  // Title ID (8 байт)
  let titleId = '';
  for (let i = 0; i < 8; i++) {
    titleId += buffer[offHeader + 0x44 + i].toString(16).padStart(2, '0');
  }
  
  // System Version (4 байта)
  const systemVersion = (buffer[offHeader + 0x4C] << 24) | 
                       (buffer[offHeader + 0x4D] << 16) | 
                       (buffer[offHeader + 0x4E] << 8) | 
                       buffer[offHeader + 0x4F];
  
  // Title Version (2 байта)
  const titleVersion = (buffer[offHeader + 0x50] << 8) | buffer[offHeader + 0x51];
  
  // Content Count (2 байта)
  const contentCount = (buffer[offHeader + 0x9E] << 8) | buffer[offHeader + 0x9F];
  
  // Boot Content Index (2 байта)
  const bootContent = (buffer[offHeader + 0xA0] << 8) | buffer[offHeader + 0xA1];
  
  // Content Info Records Count (2 байта)
  const contentInfoCount = (buffer[offHeader + 0xA2] << 8) | buffer[offHeader + 0xA3];
  
  // Переходим к списку содержимого
  const contentOffset = offHeader + 0xC4 + contentInfoCount * 0x24;
  
  // Проверка, что буфер достаточно большой
  if (buffer.length < contentOffset + contentCount * 0x30) {
    throw new Error('TMD buffer too small for content entries');
  }
  
  const contents = [];
  for (let i = 0; i < contentCount; i++) {
    const off = contentOffset + i * 0x30;
    
    // Content ID (4 байта)
    const cid = (buffer[off] << 24) | (buffer[off + 1] << 16) | 
               (buffer[off + 2] << 8) | buffer[off + 3];
    
    // Content Index (2 байта)
    const index = (buffer[off + 4] << 8) | buffer[off + 5];
    
    // Content Type (2 байта)
    const contentType = (buffer[off + 6] << 8) | buffer[off + 7];
    
    // Content Size (8 байт)
    let size = 0n;
    for (let j = 0; j < 8; j++) {
      size = (size << 8n) | BigInt(buffer[off + 8 + j]);
    }
    
    // SHA-256 Hash (32 байта)
    let hash = '';
    for (let j = 0; j < 32; j++) {
      hash += buffer[off + 16 + j].toString(16).padStart(2, '0');
    }
    
    contents.push({
      id: cid.toString(16).padStart(8, '0'),
      index: index,
      type: contentType,
      size: Number(size), // Преобразуем в число для удобства
      hash: hash
    });
  }
  
  return {
    header: {
      issuer: issuer,
      version: version,
      ca_crl_version: caCrlVersion,
      signer_crl_version: signerCrlVersion,
      title_id: titleId,
      system_version: systemVersion,
      title_version: titleVersion,
      content_count: contentCount,
      boot_content: bootContent
    },
    contents: contents
  };
}

function parseCetk(buffer) {
  if (buffer.length < 0x140) {
    throw new Error('Invalid CETK buffer size');
  }
  
  // Определение длины сигнатуры
  const sigType = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3];
  
  let sigLen = 4;
  switch (sigType) {
    case 0x00010000: // RSA-2048
      sigLen += 0x200 + 0x3C;
      break;
    case 0x00010001: // RSA-1024
      sigLen += 0x100 + 0x3C;
      break;
    case 0x00010002: // Elliptic Curve
      sigLen += 0x3C + 0x40;
      break;
    case 0x00010003: // RSA-4096
      sigLen += 0x400 + 0x3C;
      break;
    default:
      sigLen = 0x140; // По умолчанию RSA-2048
  }
  
  const offHeader = sigLen;
  
  // Проверка минимального размера
  if (buffer.length < offHeader + 0x200) {
    throw new Error('CETK buffer too small');
  }
  
  // Извлечение информации из заголовка CETK
  let issuer = '';
  for (let i = 0; i < 0x40 && buffer[offHeader + i] !== 0; i++) {
    issuer += String.fromCharCode(buffer[offHeader + i]);
  }
  
  // Title Key (16 байт) - начинается с offset 0x7F относительно начала заголовка
  let titleKey = '';
  for (let i = 0; i < 16; i++) {
    titleKey += buffer[offHeader + 0x7F + i].toString(16).padStart(2, '0');
  }
  
  // Ticket ID (8 байт)
  let ticketId = '';
  for (let i = 0; i < 8; i++) {
    ticketId += buffer[offHeader + 0x90 + i].toString(16).padStart(2, '0');
  }
  
  // Console ID (4 байта)
  let consoleId = '';
  for (let i = 0; i < 4; i++) {
    consoleId += buffer[offHeader + 0x98 + i].toString(16).padStart(2, '0');
  }
  
  // Title ID (8 байт)
  let titleId = '';
  for (let i = 0; i < 8; i++) {
    titleId += buffer[offHeader + 0x9C + i].toString(16).padStart(2, '0');
  }
  
  // Common Key Index
  const commonKeyIndex = buffer[offHeader + 0x1BF];
  
  return {
    header: {
      issuer: issuer,
      title_key: titleKey,
      ticket_id: ticketId,
      console_id: consoleId,
      title_id: titleId,
      common_key_index: commonKeyIndex
    }
  };
}
