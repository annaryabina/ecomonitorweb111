// proxy-server.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = 3000;

app.get('/api/air-quality/:city', async (req, res) => {
    try {
        const city = req.params.city;
        const urls = {
            lipetsk: 'https://www.accuweather.com/ru/ru/lipetsk/293886/air-quality-index/293886',
            moscow: 'https://www.accuweather.com/ru/ru/moscow/294021/air-quality-index/294021',
            petersburg: 'https://www.accuweather.com/ru/ru/saint-petersburg/295212/air-quality-index/295212'
        };
        
        const url = urls[city];
        if (!url) {
            return res.status(404).json({ error: 'Город не найден' });
        }
        
        // Загружаем страницу
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // Парсим HTML
        const $ = cheerio.load(response.data);
        
        // Ищем AQI
        let aqi = null;
        const aqNumber = $('.aq-number').text().trim();
        if (aqNumber) {
            aqi = parseInt(aqNumber);
        }
        
        // Если не нашли, ищем в других местах
        if (!aqi) {
            $('[class*="aqi"], [class*="index"]').each((i, elem) => {
                const text = $(elem).text().trim();
                const parsed = parseInt(text);
                if (!isNaN(parsed) && parsed > 0 && parsed <= 500) {
                    aqi = parsed;
                    return false; // Прерываем цикл
                }
            });
        }
        
        // Собираем данные о загрязнителях
        const components = {};
        const text = $('body').text();
        
        // Регулярные выражения для поиска загрязнителей
        const patterns = {
            pm2_5: /PM2\.5[:\s]*([\d\.]+)/i,
            pm10: /PM10[:\s]*([\d\.]+)/i,
            no2: /NO₂[:\s]*([\d\.]+)|NO2[:\s]*([\d\.]+)/i,
            o3: /O₃[:\s]*([\d\.]+)|O3[:\s]*([\d\.]+)/i,
            so2: /SO₂[:\s]*([\d\.]+)|SO2[:\s]*([\d\.]+)/i,
            co: /CO[:\s]*([\d\.]+)/i
        };
        
        for (const [key, pattern] of Object.entries(patterns)) {
            const match = text.match(pattern);
            if (match) {
                components[key] = parseFloat(match[1] || match[2]);
            }
        }
        
        // Возвращаем данные
        res.json({
            city: city,
            aqi: aqi || 50,
            components: components,
            source: 'AccuWeather (парсинг через прокси)',
            timestamp: new Date().toISOString(),
            url: url
        });
        
    } catch (error) {
        console.error('Ошибка прокси-сервера:', error);
        res.status(500).json({ error: 'Ошибка парсинга данных' });
    }
});

app.listen(PORT, () => {
    console.log(`Прокси-сервер запущен на порту ${PORT}`);
    console.log('Пример запроса: http://localhost:3000/api/air-quality/lipetsk');
});