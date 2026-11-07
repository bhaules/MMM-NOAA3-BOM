/* MagicMirror²
 * Module: MMM-NOAA3
 * By Cowboysdude special Thanks to JimL from php help forum!
 * Updated by mumblebaj
 */
var NodeHelper = require("node_helper");

// Moon phase is calculated locally: the old moon API (api.farmsense.net) no longer exists.
const SYNODIC_MONTH = 29.530588853; // days
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // 2000-01-06 18:14 UTC

function moonPhaseName(date) {
    const days = (date.getTime() - KNOWN_NEW_MOON) / 86400000;
    const age = ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH; // 0 .. 29.53
    const names = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
        "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"];
    // 8 equal slices centred on the main phases
    return names[Math.floor((age / SYNODIC_MONTH) * 8 + 0.5) % 8];
}

module.exports = NodeHelper.create({

    config: {
        updateInterval: 60 * 60 * 1000
    },
    provider: null,
    updateTimer: null,
    providers: {
        piratesky: 'ds',
        openweather: 'ow',
        wunderground: 'wg',
        apixu: 'ax',
        weatherbit: 'wb',
        weatherunlocked: 'wu',
        accuweather: 'aw',
        msn: 'ms',
        bom: 'bom',
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification !== "MMM-NOAA3") {
            return;
        }
        // Every browser that shows the mirror sends this on start. Only one update timer may run,
        // otherwise each page reload adds another timer and the APIs get polled again and again.
        this.config = payload;
        this.provider = this.getProviderFromConfig(payload);
        this.provider.addModuleConfiguration(payload);
        this.updateAll();
        this.scheduleUpdate();
    },

    scheduleUpdate: function () {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        const interval = this.config.updateInterval || 60 * 60 * 1000;
        this.updateTimer = setInterval(() => {
            console.log("NOAA3 weather updated.. next update in " + Math.round(interval / 60000) + " min");
            this.updateAll();
        }, interval);
    },

    updateAll: function () {
        this.getData();
        this.getSRSS();
        this.getAIR();
        this.getMoonData();
    },

    getMoonData: function () {
        this.sendSocketNotification("MOON_RESULT", moonPhaseName(new Date()));
    },

    getData: async function () {
        try {
            const response = await this.provider.fetchWeatherData();
            this.sendSocketNotification("WEATHER_RESULT", response || 'NO_WEATHER_RESULT');
        } catch (error) {
            console.error("Error fetching weather data:" + error);
            this.sendSocketNotification("WEATHER_RESULT", 'NO_WEATHER_RESULT');
        }
    },

    getSRSS: async function () {
        try {
            const response = await this.provider.fetchSunriseSunset();
            this.sendSocketNotification("SRSS_RESULT", response || 'NO_SRSS_DATA');
        } catch (error) {
            console.error("Error fetching SRSS data:" + error);
            this.sendSocketNotification("SRSS_RESULT", 'NO_SRSS_DATA');
        }
    },

    getAIR: async function () {
        try {
            const response = await this.provider.fetchAirQuality();
            this.sendSocketNotification("AIR_RESULT", response || 'NO_AIR_DATA');
        } catch (error) {
            console.error("Error fetching Air Data:", error);
            this.sendSocketNotification("AIR_RESULT", 'NO_AIR_DATA');
        }
    },

    getProviderFromConfig: function (config) {
        if (!this.providers[config.provider]) {
            throw new Error('Invalid config No provider selected');
        }
        return require('./providers/' + this.providers[config.provider] + '.js');
    },

    moonPhaseName: moonPhaseName
});
