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
        // Здесь должна быть логика извлечения информации из TID
        // Преобразуем TID в верхний регистр для единообразия
        const normalizedTid = tid.toUpperCase().padStart(16, '0');
        
        // Пример декодирования информации из TID для Nintendo 3DS
        let category = 'Unknown';
        let type = 'Unknown';
        let name = 'Unknown Title';
        let region = 'Unknown';
        let publisher = 'Unknown';
        
        // Простая эвристика для определения категории по первым символам
        if (normalizedTid.length >= 8) {
            const prefix = normalizedTid.substring(0, 8);
            
            // Некоторые известные префиксы для Nintendo 3DS
            const categories = {
                '00040000': { category: 'Application', type: 'Game' },
                '00040001': { category: 'System Application', type: 'System Software' },
                '00040002': { category: 'DLP Child', type: 'Download Play' },
                '0004000E': { category: 'Update', type: 'System Update' },
                '00040010': { category: 'System Data Archive', type: 'Essential System Data' },
                '0004001B': { category: 'Shared Data Archive', type: 'Shared System Data' },
                '00040030': { category: 'Applet', type: 'System Applet' },
                '00040080': { category: 'Firmware', type: 'Firmware Package' },
                '0004008C': { category: 'DLC', type: 'Downloadable Content' },
                '000400DB': { category: 'Demo', type: 'Demo Version' }
            };
            
            if (categories[prefix]) {
                category = categories[prefix].category;
                type = categories[prefix].type;
            } else {
                category = 'Custom/Unknown';
                type = 'Custom Title';
            }
        }
        
        // Таблица известных тайтлов
        const knownTitles = {
            '0004003000009402': { name: 'Internet Browser', region: 'USA', publisher: 'Nintendo' },
            '0004003000008F02': { name: 'Internet Browser', region: 'Europe', publisher: 'Nintendo' },
            '0004003000008B02': { name: 'Internet Browser', region: 'Japan', publisher: 'Nintendo' },
            '0004003000009502': { name: 'Internet Browser', region: 'Australia', publisher: 'Nintendo' },
            '0004003000009902': { name: 'Internet Browser', region: 'Korea', publisher: 'Nintendo' },
            '0004003000009802': { name: 'Internet Browser', region: 'China', publisher: 'Nintendo' },
            '0004003000008602': { name: 'Camera Applet', region: 'USA', publisher: 'Nintendo' },
            '0004003000008702': { name: 'Friends List', region: 'USA', publisher: 'Nintendo' },
            '0004003000008802': { name: 'Game Notes', region: 'USA', publisher: 'Nintendo' }
        };
        
        // Проверяем, есть ли информация о тайтле в таблице известных тайтлов
        if (knownTitles[normalizedTid]) {
            const titleInfo = knownTitles[normalizedTid];
            name = titleInfo.name;
            region = titleInfo.region;
            publisher = titleInfo.publisher;
        } else {
            // Если тайтл не найден в таблице, пытаемся определить регион по другому методу
            // Для 3DS регион часто определяется по последним 2 символам (регион-код)
            if (normalizedTid.length >= 16) {
                const regionCodeHex = normalizedTid.substring(14, 16);
                const regionCode = parseInt(regionCodeHex, 16);
                
                // Таблица регионов для 3DS
                switch(regionCode) {
                    case 0x00:
                        region = 'Japan';
                        break;
                    case 0x01:
                        region = 'USA';
                        break;
                    case 0x02:
                        region = 'Europe';
                        break;
                    case 0x03:
                        region = 'Australia';
                        break;
                    case 0x04:
                        region = 'China';
                        break;
                    case 0x05:
                        region = 'Korea';
                        break;
                    case 0x06:
                        region = 'Taiwan';
                        break;
                    default:
                        region = 'World/Unknown';
                }
            }
            
            // Генерируем имя на основе TID если не нашли в таблице
            name = `Title ${normalizedTid}`;
        }
        
        // Отправляем результат
        res.status(200).json({
            tid: normalizedTid,
            info: {
                category,
                type,
                name,
                region,
                publisher,
                raw: {
                    full: normalizedTid,
                    prefix: normalizedTid.substring(0, 8),
                    suffix: normalizedTid.substring(8)
                }
            }
        });
    } catch (error) {
        console.error('Error processing TID:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
                                 
