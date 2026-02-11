// Фоновый сервис для периодической проверки и обработки данных

// ... существующий код остается ...

// ========== API ДЛЯ ВЕБ-ПРИЛОЖЕНИЯ ==========

// Обработчик сообщений от веб-приложения
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    console.log('Получен запрос от веб-приложения:', request);
    
    if (sender.url && !sender.url.startsWith('chrome-extension://')) {
        // Проверяем разрешенные домены
        const allowedDomains = [
            'http://localhost',
            'https://eco-monitor-app.netlify.app',
            'https://eco-monitor-app.vercel.app'
        ];
        
        const isAllowed = allowedDomains.some(domain => sender.url.startsWith(domain));
        
        if (!isAllowed) {
            console.warn('Запрос от неразрешенного домена:', sender.url);
            sendResponse({ error: 'Домен не разрешен' });
            return true;
        }
        
        handleExternalRequest(request, sender, sendResponse);
        return true;
    }
    
    // Для внутренних запросов
    return true;
});

async function handleExternalRequest(request, sender, sendResponse) {
    try {
        switch (request.action) {
            case 'getCityData':
                const cityData = await getCityData(request.city);
                sendResponse({ success: true, data: cityData });
                break;
                
            case 'getAllData':
                const allData = await getAllCitiesData();
                sendResponse({ success: true, data: allData });
                break;
                
            case 'getSettings':
                const settings = await getExtensionSettings();
                sendResponse({ success: true, data: settings });
                break;
                
            case 'updateSettings':
                await updateExtensionSettings(request.settings);
                sendResponse({ success: true });
                break;
                
            case 'forceRefresh':
                await checkAllCities();
                sendResponse({ success: true });
                break;
                
            case 'getHistory':
                const history = await getUpdateHistory();
                sendResponse({ success: true, data: history });
                break;
                
            case 'testConnection':
                sendResponse({ 
                    success: true, 
                    message: 'Расширение подключено',
                    version: '1.0',
                    cities: ['lipetsk', 'moscow', 'petersburg']
                });
                break;
                
            default:
                sendResponse({ error: 'Неизвестное действие' });
        }
    } catch (error) {
        console.error('Ошибка обработки внешнего запроса:', error);
        sendResponse({ error: error.message });
    }
}

async function getCityData(city) {
    const storageKey = `${city}_real_data`;
    const lastUpdateKey = `${city}_last_real_update`;
    
    const result = await chrome.storage.local.get([storageKey, lastUpdateKey]);
    
    if (!result[storageKey]) {
        // Если данных нет, парсим их
        await fetchCityData(city);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем парсинг
        
        // Повторно получаем данные
        const newResult = await chrome.storage.local.get([storageKey, lastUpdateKey]);
        return {
            data: newResult[storageKey] || getMockDataForCity(city),
            lastUpdate: newResult[lastUpdateKey] || new Date().toISOString(),
            source: 'extension'
        };
    }
    
    return {
        data: result[storageKey],
        lastUpdate: result[lastUpdateKey],
        source: 'extension'
    };
}

async function getAllCitiesData() {
    const cities = ['lipetsk', 'moscow', 'petersburg'];
    const result = {};
    
    for (const city of cities) {
        const cityData = await getCityData(city);
        result[city] = cityData;
    }
    
    return result;
}

async function getExtensionSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get([
            'thresholds', 
            'selectedCity', 
            'notificationsEnabled',
            'useRealData'
        ], (result) => {
            resolve({
                thresholds: result.thresholds || { aqi: 100, pm25: 35 },
                selectedCity: result.selectedCity || 'lipetsk',
                notificationsEnabled: result.notificationsEnabled !== false,
                useRealData: result.useRealData !== false,
                cities: ['lipetsk', 'moscow', 'petersburg']
            });
        });
    });
}

async function updateExtensionSettings(settings) {
    return new Promise((resolve) => {
        chrome.storage.sync.set(settings, () => {
            resolve();
        });
    });
}

async function getUpdateHistory() {
    const result = await chrome.storage.local.get(null);
    const history = [];
    
    for (const key in result) {
        if (key.endsWith('_last_real_update')) {
            const city = key.replace('_last_real_update', '');
            history.push({
                city: city,
                lastUpdate: result[key],
                data: result[`${city}_real_data`]
            });
        }
    }
    
    return history;
}

// Функция для проверки установленного расширения
async function isExtensionInstalled() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            chrome.runtime.id,
            { action: 'ping' },
            (response) => {
                resolve(response !== undefined);
            }
        );
    });
}

// Сообщаем о готовности API
console.log('API для веб-приложения готово');