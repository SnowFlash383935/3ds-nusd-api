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
        // Для демонстрации создадим фиктивные данные
        
        // Преобразуем TID в верхний регистр для единообразия
        const normalizedTid = tid.toUpperCase();
        
        // Пример декодирования информации из TID для Nintendo 3DS
        // TID в Nintendo 3DS обычно состоит из 16 символов (64 бита)
        // Первые 8 символов - это категория/тип контента
        // Следующие 8 символов - уникальный идентификатор
        
        let category = 'Unknown';
        let type = 'Unknown';
        let name = 'Unknown Title';
        let region = 'Unknown';
        
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
        
        // Эвристика для определения региона по последним символам
        if (normalizedTid.length >= 16) {
            const suffix = normalizedTid.substring(normalizedTid.length - 4);
            const regionCode = parseInt(suffix, 16) & 0xFF; // Берем младший байт
            
            // Упрощенная таблица регионов
            switch(regionCode) {
                case 0x00:
                    region = 'Japan';
                    break;
                case 0x01:
                    region = 'North America';
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
        
        // Генерируем имя на основе TID
        name = `Title ${normalizedTid}`;
        
        // Отправляем результат
        res.status(200).json({
            tid: normalizedTid,
            info: {
                category,
                type,
                name,
                region,
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
