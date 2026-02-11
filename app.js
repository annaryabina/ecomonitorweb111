// Веб-приложение для взаимодействия с расширением Chrome
class EcoMonitorWebApp {
    constructor() {
        this.extensionId = 'adcdkleggcimnddgjlffagknbfbkbomp'; // Замените на реальный ID
        this.extensionInstalled = false;
        this.connected = false;
        this.currentCity = 'lipetsk';
        this.settings = {
            thresholds: { aqi: 100, pm25: 35 },
            notificationsEnabled: true,
            autoSync: true,
            useExtensionData: true,
            syncInterval: 60
        };
        
        this.data = null;
        this.syncInterval = null;
        
        this.init();
    }
    
    async init() {
        console.log('Веб-приложение: Инициализация');
        
        // Загружаем настройки
        this.loadSettings();
        
        // Проверяем подключение к расширению
        await this.checkExtensionConnection();
        
        // Настраиваем интерфейс
        this.setupUI();
        
        // Начинаем синхронизацию
        this.startSync();
        
        // Показываем начальные данные
        this.updateDisplay();
    }
    
    setupUI() {
        // Выбор города
        const citySelect = document.getElementById('city-select');
        citySelect.value = this.currentCity;
        citySelect.addEventListener('change', (e) => {
            this.currentCity = e.target.value;
            this.updateDisplay();
        });
        
        // Кнопка проверки подключения
        document.getElementById('check-connection-btn').addEventListener('click', async () => {
            await this.checkExtensionConnection(true);
        });
        
        // Кнопка установки расширения
        document.getElementById('install-extension-btn').addEventListener('click', () => {
            this.openExtensionStore();
        });
        
        // Кнопка обновления данных
        document.getElementById('manual-refresh-btn').addEventListener('click', () => {
            this.updateDisplay(true);
        });
        
        // Кнопка принудительного обновления в расширении
        document.getElementById('force-extension-refresh').addEventListener('click', async () => {
            await this.forceExtensionRefresh();
        });
        
        // Кнопка показа демо-данных
        document.getElementById('show-demo-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.showDemoMode();
        });
        
        // Настройки синхронизации
        document.getElementById('auto-sync').addEventListener('change', (e) => {
            this.settings.autoSync = e.target.checked;
            this.saveSettings();
            if (this.settings.autoSync) {
                this.startSync();
            } else {
                this.stopSync();
            }
        });
        
        document.getElementById('use-extension-data').addEventListener('change', (e) => {
            this.settings.useExtensionData = e.target.checked;
            this.saveSettings();
            this.updateDisplay();
        });
        
        document.getElementById('sync-interval').addEventListener('change', (e) => {
            this.settings.syncInterval = parseInt(e.target.value);
            this.saveSettings();
            this.restartSync();
        });
        
        // Загружаем настройки в UI
        this.updateSettingsUI();
    }
    
    updateSettingsUI() {
        document.getElementById('auto-sync').checked = this.settings.autoSync;
        document.getElementById('use-extension-data').checked = this.settings.useExtensionData;
        document.getElementById('sync-interval').value = this.settings.syncInterval;
    }
    
    async checkExtensionConnection(showMessage = false) {
        try {
            // Пытаемся отправить сообщение расширению
            const response = await this.sendMessageToExtension({
                action: 'testConnection'
            });
            
            if (response && response.success) {
                this.extensionInstalled = true;
                this.connected = true;
                this.updateConnectionStatus(true, response.message);
                
                if (showMessage) {
                    this.showNotification('Расширение подключено успешно!', 'success');
                }
                
                return true;
            }
        } catch (error) {
            console.log('Расширение не установлено или не отвечает:', error);
        }
        
        this.extensionInstalled = false;
        this.connected = false;
        this.updateConnectionStatus(false, 'Расширение не установлено');
        
        if (showMessage) {
            this.showNotification('Расширение не найдено. Установите его для полного функционала.', 'warning');
        }
        
        return false;
    }
    
    async sendMessageToExtension(message) {
        return new Promise((resolve, reject) => {
            // Проверяем, установлено ли расширение
            if (!chrome || !chrome.runtime) {
                reject(new Error('Расширение недоступно'));
                return;
            }
            
            chrome.runtime.sendMessage(this.extensionId, message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    updateConnectionStatus(connected, message) {
        const statusElement = document.getElementById('extension-status');
        const extensionInfo = document.getElementById('extension-info');
        const connectionPanel = document.getElementById('connection-panel');
        const fallbackMessage = document.getElementById('fallback-message');
        
        if (connected) {
            statusElement.innerHTML = '<i class="fas fa-plug"></i> <span>Расширение подключено</span>';
            statusElement.className = 'extension-status connected';
            extensionInfo.textContent = 'Расширение установлено';
            connectionPanel.style.display = 'none';
            fallbackMessage.style.display = 'none';
        } else {
            statusElement.innerHTML = '<i class="fas fa-unlink"></i> <span>Расширение не подключено</span>';
            statusElement.className = 'extension-status';
            extensionInfo.textContent = 'Расширение не установлено';
            connectionPanel.style.display = 'block';
            fallbackMessage.style.display = 'block';
        }
    }
    
    openExtensionStore() {
        // Ссылка на расширение в Chrome Web Store
        const extensionUrl = `https://chrome.google.com/webstore/detail/${this.extensionId}`;
        window.open(extensionUrl, '_blank');
    }
    
    async updateDisplay(forceRefresh = false) {
        try {
            // Обновляем время
            this.updateTime();
            
            // Получаем данные
            if (this.connected && this.settings.useExtensionData) {
                await this.fetchDataFromExtension(forceRefresh);
            } else {
                this.useDemoData();
            }
            
            // Отображаем данные
            this.renderData();
            
        } catch (error) {
            console.error('Ошибка обновления данных:', error);
            this.showError('Ошибка получения данных');
        }
    }
    
    async fetchDataFromExtension(forceRefresh = false) {
        try {
            if (forceRefresh) {
                // Запускаем принудительное обновление в расширении
                await this.sendMessageToExtension({
                    action: 'forceRefresh'
                });
                
                // Ждем обновления данных
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Получаем данные для текущего города
            const response = await this.sendMessageToExtension({
                action: 'getCityData',
                city: this.currentCity
            });
            
            if (response.success) {
                this.data = response.data;
                document.getElementById('data-status').textContent = 'Данные: из расширения';
            } else {
                throw new Error('Ошибка получения данных из расширения');
            }
            
        } catch (error) {
            console.error('Ошибка получения данных из расширения:', error);
            this.useDemoData();
        }
    }
    
    useDemoData() {
        // Используем демо-данные
        const demoData = this.getDemoData();
        this.data = {
            data: demoData,
            lastUpdate: new Date().toISOString(),
            source: 'demo'
        };
        document.getElementById('data-status').textContent = 'Данные: демо-режим';
    }
    
    getDemoData() {
        const demoData = {
            lipetsk: { aqi: 65, pm2_5: 25.3, pm10: 45.1, no2: 12.4, o3: 28.7, so2: 4.2, co: 0.8 },
            moscow: { aqi: 42, pm2_5: 18.1, pm10: 35.2, no2: 25.6, o3: 35.4, so2: 3.1, co: 0.6 },
            petersburg: { aqi: 35, pm2_5: 15.2, pm10: 28.3, no2: 18.9, o3: 42.1, so2: 2.4, co: 0.5 }
        };
        
        const data = demoData[this.currentCity] || demoData.lipetsk;
        
        return {
            aqi: data.aqi,
            components: {
                pm2_5: data.pm2_5,
                pm10: data.pm10,
                no2: data.no2,
                o3: data.o3,
                so2: data.so2,
                co: data.co
            },
            source: 'Демо-данные',
            timestamp: new Date().toISOString()
        };
    }
    
    renderData() {
        const dashboard = document.getElementById('dashboard');
        const data = this.data?.data;
        
        if (!data) {
            dashboard.innerHTML = '<div class="loading">Загрузка данных...</div>';
            return;
        }
        
        const aqi = data.aqi || 0;
        const components = data.components || {};
        const source = data.source || 'Неизвестный источник';
        
        // Определяем уровень AQI
        let aqiLevel = '';
        let aqiColor = '';
        let recommendations = '';
        
        if (aqi <= 50) {
            aqiLevel = 'Хорошо';
            aqiColor = '#4CAF50';
            recommendations = 'Воздух чистый. Можно совершать прогулки и заниматься спортом на улице.';
        } else if (aqi <= 100) {
            aqiLevel = 'Умеренно';
            aqiColor = '#FFC107';
            recommendations = 'Умеренное загрязнение. Людям с заболеваниями дыхательных путей стоит быть осторожнее.';
        } else if (aqi <= 150) {
            aqiLevel = 'Вредно для чувствительных групп';
            aqiColor = '#FF9800';
            recommendations = 'Рекомендуется ограничить пребывание на улице детям, пожилым людям и астматикам.';
        } else if (aqi <= 200) {
            aqiLevel = 'Вредно';
            aqiColor = '#F44336';
            recommendations = 'Всем рекомендуется ограничить время на улице, носить маску, закрыть окна.';
        } else {
            aqiLevel = 'Очень вредно';
            aqiColor = '#8B0000';
            recommendations = 'Опасный уровень! Оставайтесь дома, используйте очиститель воздуха.';
        }
        
        // Обновляем время обновления
        if (this.data.lastUpdate) {
            const time = new Date(this.data.lastUpdate);
            document.getElementById('update-time').textContent = 
                time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }
        
        // Обновляем источник данных
        document.getElementById('data-source').textContent = source;
        
        // Отображаем информацию о городе
        const cityNames = {
            lipetsk: 'Липецке',
            moscow: 'Москве',
            petersburg: 'Санкт-Петербурге'
        };
        document.getElementById('city-info').textContent = 
            `Данные для ${cityNames[this.currentCity]} (${source})`;
        
        // Создаем HTML для дашборда
        dashboard.innerHTML = `
            <div class="dashboard-grid">
                <div class="card aqi-card" style="border-color: ${aqiColor}">
                    <div class="card-header">
                        <h3><i class="fas fa-cloud-sun"></i> Индекс качества воздуха (AQI)</h3>
                        <span class="aqi-level">${aqiLevel}</span>
                    </div>
                    <div class="card-body">
                        <div class="aqi-value" style="color: ${aqiColor}">${aqi}</div>
                        <div class="aqi-scale">
                            <div class="scale-point" style="background: ${aqi <= 50 ? aqiColor : '#e0e0e0'}">0-50</div>
                            <div class="scale-point" style="background: ${aqi > 50 && aqi <= 100 ? aqiColor : '#e0e0e0'}">51-100</div>
                            <div class="scale-point" style="background: ${aqi > 100 && aqi <= 150 ? aqiColor : '#e0e0e0'}">101-150</div>
                            <div class="scale-point" style="background: ${aqi > 150 && aqi <= 200 ? aqiColor : '#e0e0e0'}">151-200</div>
                            <div class="scale-point" style="background: ${aqi > 200 ? aqiColor : '#e0e0e0'}">201+</div>
                        </div>
                    </div>
                </div>
                
                <div class="card pollutants-card">
                    <div class="card-header">
                        <h3><i class="fas fa-industry"></i> Уровни загрязнителей</h3>
                        <span class="unit">µg/m³</span>
                    </div>
                    <div class="card-body">
                        <div class="pollutant">
                            <span class="pollutant-name">PM2.5</span>
                            <span class="pollutant-value">${components.pm2_5 ? components.pm2_5.toFixed(1) : '--'}</span>
                            <div class="pollutant-bar">
                                <div class="bar-fill" style="width: ${Math.min(100, (components.pm2_5 || 0) / 35 * 100)}%"></div>
                            </div>
                        </div>
                        <div class="pollutant">
                            <span class="pollutant-name">PM10</span>
                            <span class="pollutant-value">${components.pm10 ? components.pm10.toFixed(1) : '--'}</span>
                            <div class="pollutant-bar">
                                <div class="bar-fill" style="width: ${Math.min(100, (components.pm10 || 0) / 50 * 100)}%"></div>
                            </div>
                        </div>
                        <div class="pollutant">
                            <span class="pollutant-name">NO₂</span>
                            <span class="pollutant-value">${components.no2 ? components.no2.toFixed(1) : '--'}</span>
                            <div class="pollutant-bar">
                                <div class="bar-fill" style="width: ${Math.min(100, (components.no2 || 0) / 40 * 100)}%"></div>
                            </div>
                        </div>
                        <div class="pollutant">
                            <span class="pollutant-name">O₃</span>
                            <span class="pollutant-value">${components.o3 ? components.o3.toFixed(1) : '--'}</span>
                            <div class="pollutant-bar">
                                <div class="bar-fill" style="width: ${Math.min(100, (components.o3 || 0) / 60 * 100)}%"></div>
                            </div>
                        </div>
                        <div class="pollutant">
                            <span class="pollutant-name">SO₂</span>
                            <span class="pollutant-value">${components.so2 ? components.so2.toFixed(1) : '--'}</span>
                            <div class="pollutant-bar">
                                <div class="bar-fill" style="width: ${Math.min(100, (components.so2 || 0) / 20 * 100)}%"></div>
                            </div>
                        </div>
                        <div class="pollutant">
                            <span class="pollutant-name">CO</span>
                            <span class="pollutant-value">${components.co ? components.co.toFixed(2) : '--'}</span>
                            <div class="pollutant-bar">
                                <div class="bar-fill" style="width: ${Math.min(100, (components.co || 0) / 5 * 100)}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card recommendations-card">
                    <div class="card-header">
                        <h3><i class="fas fa-heartbeat"></i> Рекомендации</h3>
                    </div>
                    <div class="card-body">
                        <div class="recommendations">
                            <p><strong>В ${cityNames[this.currentCity]}:</strong> ${recommendations}</p>
                            ${this.getAdditionalRecommendations(aqi)}
                        </div>
                        ${this.checkThresholds(data) ? `
                            <div class="warning" style="animation: pulse 2s infinite">
                                <i class="fas fa-exclamation-triangle"></i>
                                <span>Превышены пороговые значения!</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    getAdditionalRecommendations(aqi) {
        if (aqi > 100) {
            return `
                <div class="additional-recommendations">
                    <h4>Дополнительные рекомендации:</h4>
                    <ul>
                        <li>Используйте очистители воздуха в помещении</li>
                        <li>Носите защитные маски на улице</li>
                        <li>Избегайте интенсивных физических нагрузок</li>
                        <li>Проветривайте помещения только в утренние часы</li>
                    </ul>
                </div>
            `;
        }
        return '';
    }
    
    checkThresholds(data) {
        if (!data || !data.aqi) return false;
        
        const aqi = data.aqi;
        const pm25 = data.components?.pm2_5 || 0;
        
        return aqi >= this.settings.thresholds.aqi || pm25 >= this.settings.thresholds.pm25;
    }
    
    updateTime() {
        const now = new Date();
        document.getElementById('update-time').textContent = 
            now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    async forceExtensionRefresh() {
        if (!this.connected) {
            this.showNotification('Сначала подключите расширение', 'warning');
            return;
        }
        
        try {
            this.showNotification('Запуск парсинга в расширении...', 'info');
            
            await this.sendMessageToExtension({
                action: 'forceRefresh'
            });
            
            this.showNotification('Парсинг запущен. Данные обновятся через несколько секунд.', 'success');
            
            // Ждем и обновляем данные
            setTimeout(() => {
                this.updateDisplay(true);
            }, 5000);
            
        } catch (error) {
            this.showNotification('Ошибка запуска парсинга', 'error');
            console.error(error);
        }
    }
    
    showDemoMode() {
        this.settings.useExtensionData = false;
        this.saveSettings();
        this.updateSettingsUI();
        this.updateDisplay();
        this.showNotification('Переключено на демо-режим', 'info');
    }
    
    startSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        if (this.settings.autoSync) {
            this.syncInterval = setInterval(() => {
                this.updateDisplay();
            }, this.settings.syncInterval * 1000);
            
            console.log(`Синхронизация запущена с интервалом ${this.settings.syncInterval} секунд`);
        }
    }
    
    stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('Синхронизация остановлена');
        }
    }
    
    restartSync() {
        this.stopSync();
        this.startSync();
    }
    
    showNotification(message, type = 'info') {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i>
            <span>${message}</span>
        `;
        
        // Стили для уведомления
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Автоматически скрываем через 5 секунд
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }, 5000);
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    loadSettings() {
        const saved = localStorage.getItem('ecoMonitorWebSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
    }
    
    saveSettings() {
        localStorage.setItem('ecoMonitorWebSettings', JSON.stringify(this.settings));
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.ecoMonitorApp = new EcoMonitorWebApp();
});