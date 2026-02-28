import { Buffer } from 'node:buffer';

/**
 * Основные константы Nintendo CDN
 */
const CDN_URL = "http://ccs.cdn.c.shop.nintendowifi.net/ccs/download/";

/**
 * Функция для парсинга TMD (Title Metadata)
 * TMD содержит информацию о версии тайтла и список фрагментов контента.
 */
function parseTMD(tmdBuffer) {
    // В 3DS TMD с подписью RSA-2048 смещение для кол-ва контента обычно 0x1DE или 0x204
    // Согласно 3DS-NUSD, мы ищем количество контента по смещению 0x1DE (2 байта, Big Endian)
    const contentCount = tmdBuffer.readUInt16BE(0x1DE);
    const contents = [];

    // Список чанков (Content Chunks) начинается после заголовка (обычно 0x9D4 для 3DS)
    // Каждый заголовок контента занимает 0x30 байт
    const CHUNK_OFFSET = 0x9D4; 
    
    for (let i = 0; i < contentCount; i++) {
        const offset = CHUNK_OFFSET + (i * 0x30);
        if (offset + 0x30 > tmdBuffer.length) break;

        const contentId = tmdBuffer.readUInt32BE(offset).toString(16).padStart(8, '0');
        const contentIndex = tmdBuffer.readUInt16BE(offset + 0x4);
        const contentType = tmdBuffer.readUInt16BE(offset + 0x6);
        const size = Number(tmdBuffer.readBigUInt64BE(offset + 0x8));
        const hash = tmdBuffer.slice(offset + 0x10, offset + 0x30).toString('hex');

        contents.push({ contentId, contentIndex, contentType, size, hash });
    }

    return { contentCount, contents };
}

/**
 * Serverless Handler
 */
export const handler = async (event) => {
    // Параметры: titleId (например, 0004001000022300) и version (опционально)
    const { titleId, version } = event.queryStringParameters || {};

    if (!titleId) {
        return { statusCode: 400, body: JSON.stringify({ error: "titleId is required" }) };
    }

    try {
        // 1. Загружаем TMD
        const tmdPath = version ? `tmd.${version}` : 'tmd';
        const tmdResponse = await fetch(`${CDN_URL}${titleId}/${tmdPath}`);
        
        if (!tmdResponse.ok) throw new Error(`TMD not found: ${tmdResponse.status}`);
        
        const tmdBuffer = Buffer.from(await tmdResponse.arrayBuffer());
        const tmdData = parseTMD(tmdBuffer);

        // 2. Формируем список URL для загрузки контента
        const downloadLinks = tmdData.contents.map(c => ({
            id: c.contentId,
            url: `${CDN_URL}${titleId}/${c.contentId}`,
            size: c.size
        }));

        // В serverless мы обычно не сохраняем файлы на диск, а возвращаем метаданные 
        // или инициируем стриминг в S3/Google Storage.
        return {
            statusCode: 200,
            body: JSON.stringify({
                titleId,
                version: tmdBuffer.readUInt16BE(0x1DC), // Версия из TMD
                contentCount: tmdData.contentCount,
                contents: downloadLinks
            })
        };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
