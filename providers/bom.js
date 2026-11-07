const moment = require('moment');
const https = require('https');

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (MMM-NOAA3 MagicMirror Module)' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`Status Code ${res.statusCode}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

const provider = {
    config: {},

    // Mapping BOM icon descriptors to MMM-NOAA3 icon classes
    // BOM icons: clear, cloudy, dust, fog, frost, haze, heavy_showers, light_rain,
    // light_showers, mostly_sunny, partly_cloudy, rain, showers, snow, storm, sunny, wind
    imageArray: {
        "clear": "clear",
        "sunny": "clear",
        "mostly_sunny": "mostlyclear",
        "partly_cloudy": "partlycloudy",
        "cloudy": "overcast",
        "fog": "fog",
        "haze": "fog",
        "dust": "fog",
        "frost": "snow",
        "snow": "snow",
        "light_rain": "chancerain",
        "rain": "rain",
        "light_showers": "rain",
        "showers": "rain",
        "heavy_showers": "rain",
        "light_shower": "rain",
        "shower": "rain",
        "heavy_shower": "rain",
        "storm": "tstorms",
        "wind": "fog", // Fallback for wind
        "windy": "fog",
    },

    addModuleConfiguration: function (moduleConfig) {
        if (!moduleConfig.apiKey) {
            // BOM doesn't use API keys, but relying on geohash in apiKey param for compatibility
            // or expecting `geohash` to be set.
            // Let's assume the user puts their 6-char geohash in `apiKey` or we add a `geohash` config.
            // We will fallback to moduleConfig.apiKey if geohash isn't provided.
        }
        this.config = Object.assign({}, moduleConfig);

        // Use geohash if explicitly provided, else fall back to apiKey since some users reuse that field.
        this.geohash = this.config.geohash || this.config.apiKey;

        if (!this.geohash || this.geohash.length !== 6) {
            console.error("MMM-NOAA3 bom provider error: A valid 6-character geohash is required.");
        }
    },

    fetchWeatherData: async function () {
        if (!this.geohash) return null;

        const obsUrl = `https://api.weather.bom.gov.au/v1/locations/${this.geohash}/observations`;
        const forecastUrl = `https://api.weather.bom.gov.au/v1/locations/${this.geohash}/forecasts/daily`;
        const hourlyUrl = `https://api.weather.bom.gov.au/v1/locations/${this.geohash}/forecasts/hourly`;

        try {
            // Fetch Observations, Daily Forecast, and Hourly Forecast in parallel
            const [obsData, forecastData, hourlyData] = await Promise.all([
                httpsGet(obsUrl),
                httpsGet(forecastUrl),
                httpsGet(hourlyUrl).catch(err => {
                    console.log("BOM Hourly Data Warning:", err.message);
                    return null;
                })
            ]);

            return this.parseWeatherData(obsData, forecastData, hourlyData);
        } catch (error) {
            console.log("BOM Weather Data Error:", error.message);
            return null;
        }
    },

    fetchAirQuality: async function () {
        // BOM API doesn't provide Air Quality on this endpoint directly.
        // We supply a default structure so MMM-NOAA3 doesn't break trying to read `air.aqius`
        return { air: { aqius: "N/A", pollution: 0 } };
    },

    fetchSunriseSunset: async function () {
        // We can extract sunrise/sunset from the first day of the daily forecast.
        // It's not explicitly a separate fetch in our case, but requires fetching the forecast again or 
        // extracting it from cached forecast. Since this is an independent call in node_helper, 
        // we'll fetch a 1-day forecast.
        if (!this.geohash) return null;

        const forecastUrl = `https://api.weather.bom.gov.au/v1/locations/${this.geohash}/forecasts/daily`;

        try {
            const data = await httpsGet(forecastUrl);

            if (data && data.data && data.data.length > 0) {
                const today = data.data[0];
                if (today.astronomical) {
                    const sunrise = moment.utc(today.astronomical.sunrise_time).format("YYYY-MM-DDTHH:mm:ss");
                    const sunset = moment.utc(today.astronomical.sunset_time).format("YYYY-MM-DDTHH:mm:ss");

                    // day_length is sunset - sunrise in seconds
                    const sr = moment.utc(today.astronomical.sunrise_time);
                    const ss = moment.utc(today.astronomical.sunset_time);
                    const diffSeconds = ss.diff(sr, 'seconds');

                    return {
                        sunrise: sunrise + "+00:00",
                        sunset: sunset + "+00:00",
                        day_length: diffSeconds
                    };
                }
            }
            return { sunrise: moment().format("YYYY-MM-DDTHH:mm:ss+00:00"), sunset: moment().format("YYYY-MM-DDTHH:mm:ss+00:00"), day_length: 0 };

        } catch (error) {
            console.log("BOM Sunrise-Sunset Data Error:", error.message);
            return { sunrise: moment().format("YYYY-MM-DDTHH:mm:ss+00:00"), sunset: moment().format("YYYY-MM-DDTHH:mm:ss+00:00"), day_length: 0 };
        }
    },

    parseWeatherData: function (obsJson, forecastJson, hourlyJson) {
        const obs = obsJson.data;
        const forecasts = forecastJson.data;

        // Ensure we explicitly process forecasts for today and future
        const todayStr = moment().format('YYYY-MM-DD');
        // BOM gives each day as local midnight in UTC: for Perth, Saturday 7 Nov is "2026-11-06T16:00:00Z".
        // Read it in local time (the MagicMirror server's time zone), not UTC, otherwise every day is
        // labelled one day early and today's forecast gets filtered out (tomorrow showed as "Today").
        const validForecasts = forecasts.filter(day => moment(day.date).format('YYYY-MM-DD') >= todayStr);
        const today = validForecasts[0];
        const has = v => v !== null && v !== undefined;

        // Current conditions
        const current = {
            ss: moment(today && today.astronomical ? today.astronomical.sunset_time : undefined).format('HH'),
            weather: today && today.short_text ? today.short_text.replace(/\.$/, '') : "Unknown",
            weather_f: today ? today.extended_text : "Unknown",
            temp_c: has(obs.temp) ? Math.round(obs.temp) : "-",
            temp_f: has(obs.temp) ? Math.round(obs.temp * 9 / 5 + 32) : "-",
            icon: today && today.icon_descriptor ? (this.imageArray[today.icon_descriptor] || "clear") : "clear",
            humidity: has(obs.humidity) ? obs.humidity + "%" : "-", // Module expects a string with %
            // BOM observations have no pressure or visibility. null tells the front end to show
            // "Feels like" and "Rain" (chance today) instead of made-up values.
            pressure_mb: null,
            pressure_in: null,
            visibility_mi: null,
            visibility_km: null,
            feels_like_c: has(obs.temp_feels_like) ? Math.round(obs.temp_feels_like) : null,
            feels_like_f: has(obs.temp_feels_like) ? Math.round(obs.temp_feels_like * 9 / 5 + 32) : null,
            rain_chance: today && today.rain && has(today.rain.chance) ? today.rain.chance : null,
            UV: today && today.uv && has(today.uv.max_index) ? today.uv.max_index : 0,
            wind_mph: obs.wind && has(obs.wind.speed_kilometre) ? Math.round(obs.wind.speed_kilometre * 0.621371) : 0,
            wind_kph: obs.wind && has(obs.wind.speed_kilometre) ? Math.round(obs.wind.speed_kilometre) : 0,
        };

        // Forecast (next 4 days as expected by module)
        const forecastMap = validForecasts.slice(0, 4).map(day => {
            // BOM API sometimes omits temp_min for the current day. Fall back to now.temp_now or something sensible
            // The temp_min might be null if the minimum has already passed for the day
            let tMinC = has(day.temp_min) ? day.temp_min : (day.now && has(day.now.temp_now) ? day.now.temp_now : 0);
            let tMaxC = has(day.temp_max) ? day.temp_max : 0;
            return {
                date: { weekday_short: moment(day.date).format('ddd') },
                high: {
                    fahrenheit: Math.round(tMaxC * 9 / 5 + 32),
                    celsius: Math.round(tMaxC)
                },
                low: {
                    fahrenheit: Math.round(tMinC * 9 / 5 + 32),
                    celsius: Math.round(tMinC)
                },
                desc: day.short_text,
                icon: this.imageArray[day.icon_descriptor] || "unknown"
            };
        });

        // Hourly UV Forecast (next 4 upcoming hours)
        let uvForecastMap = [];
        if (hourlyJson && hourlyJson.data && Array.isArray(hourlyJson.data)) {
            const now = moment();
            const upcoming = hourlyJson.data.filter(h => moment(h.time).isAfter(now.clone().subtract(30, 'minutes')));
            uvForecastMap = upcoming.slice(0, 4).map(h => {
                return {
                    time: h.time,
                    hour: moment(h.time).format(this.config.timeFormat == 12 ? "h:mm" : "H:mm"),
                    uv: typeof h.uv === 'number' ? h.uv : 0
                };
            });
        }

        return { current: current, forecast: forecastMap, uvForecast: uvForecastMap };
    }
};

if (typeof module !== "undefined") {
    module.exports = provider;
}
