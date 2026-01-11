// api/info.js
module.exports = async (req, res) => {
    // Разрешить CORS для всех источников
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Обработка preflight запроса
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // Только GET запросы разрешены
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    
    const { tid } = req.query;
    
    // Проверка наличия параметра tid
    if (!tid) {
        res.status(400).json({ error: 'Missing tid parameter' });
        return;
    }
    
    // Проверка формата TID (должен быть шестнадцатеричным числом)
    if (!/^[0-9A-Fa-f]+$/.test(tid)) {
        res.status(400).json({ error: 'Invalid TID format. Must be hexadecimal.' });
        return;
    }
    
    try {
        // Преобразуем TID в верхний регистр и дополним до 16 символов
        const normalizedTid = tid.toUpperCase().padStart(16, '0');
        
        // Проверка длины
        if (normalizedTid.length !== 16) {
            res.status(400).json({ error: 'Invalid TID length. Must be 16 hex characters.' });
            return;
        }
        
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
        
        // Определение региона
        let region = 'Unknown';
        const regionMap = {
            0x00: 'Japan',
            0x01: 'USA',
            0x02: 'Europe',
            0x03: 'Australia',
            0x04: 'China',
            0x05: 'Korea',
            0x06: 'Taiwan'
        };
        
        if (regionMap[regionCode] !== undefined) {
            region = regionMap[regionCode];
        }
        
        // Отправляем результат
        res.status(200).json({
            tid: normalizedTid,
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
                    },
                    region: {
                        code: regionCodeHex,
                        value: regionCode,
                        name: region
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error processing TID:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
            
