import { Buffer } from 'node:buffer';

const CDN_URL = "http://ccs.cdn.c.shop.nintendowifi.net/ccs/download/";

// Парсер TMD (Title Metadata)
function parseTMD(tmdBuffer) {
    const contentCount = tmdBuffer.readUInt16BE(0x1DE);
    const contents = [];
    const CHUNK_OFFSET = 0x9D4; 
    
    for (let i = 0; i < contentCount; i++) {
        const offset = CHUNK_OFFSET + (i * 0x30);
        if (offset + 0x30 > tmdBuffer.length) break;

        const contentId = tmdBuffer.readUInt32BE(offset).toString(16).padStart(8, '0');
        const size = Number(tmdBuffer.readBigUInt64BE(offset + 0x8));
        const hash = tmdBuffer.slice(offset + 0x10, offset + 0x30).toString('hex');

        contents.push({ contentId, size, hash });
    }
    return { 
        version: tmdBuffer.readUInt16BE(0x1DC),
        contentCount, 
        contents 
    };
}

// ЭКСПОРТ ПО УМОЛЧАНИЮ (Обязательно для Vercel/Next.js)
export default async function handler(req, res) {
    // В Vercel параметры находятся в req.query
    const { titleId, version } = req.query;

    if (!titleId) {
        return res.status(400).json({ error: "Missing titleId parameter" });
    }

    try {
        const tmdPath = version ? `tmd.${version}` : 'tmd';
        const url = `${CDN_URL}${titleId}/${tmdPath}`;
        
        const tmdResponse = await fetch(url);
        
        if (!tmdResponse.ok) {
            return res.status(404).json({ error: `TMD not found for TitleID ${titleId}` });
        }
        
        const arrayBuffer = await tmdResponse.arrayBuffer();
        const tmdBuffer = Buffer.from(arrayBuffer);
        const tmdData = parseTMD(tmdBuffer);

        // Формируем ответ
        const result = {
            titleId,
            version: tmdData.version,
            contents: tmdData.contents.map(c => ({
                id: c.contentId,
                url: `${CDN_URL}${titleId}/${c.contentId}`,
                size: c.size,
                sha256: c.hash
            }))
        };

        // Отправляем JSON-ответ
        return res.status(200).json(result);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}
