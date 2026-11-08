/* MagicMirror²
 * Module: MMM-NOAA3
 * By cowboysdude with HUGE Thanks to JimL at https://www.phphelp.com!!
 * Last updated by mumblebaj
 */

var current = {};
var srss;

Module.register("MMM-NOAA3", {
    defaults: {
        animationSpeed: 0,
        initialLoadDelay: 8000,
        rotateInterval: 60 * 1000,
        updateInterval: 21600000,
        //updateInterval: 5 * 1000,
        apiKey: "",
        airKey: "",
        pws: "",
        css: "",
        frow: true,
        nupdate: false,
        userlat: "",
        userlon: "",
        UVIndexAccessToken: "", // OpenUV API Key
        showUVForecast: true,
        uvForecastTitle: "4 Hour UV Forecast",

        langFile: {
            "en": "en-US",
            "de": "de-DE",
            "sv": "sv-SE",
            "es": "es-ES",
            "fr": "fr-FR",
            "zh_cn": "zh-CN",
            "da": "da",
            "nl": "nl-NL",
            "nb": "nb-NO"
        },

        langTrans: {
            "en": "EN",
            "de": "DL",
            "sv": "SW",
            "es": "SP",
            "fr": "FR",
            "zh_cn": "CN",
            "da": "DK",
            "nl": "NL",
            "nb": "NO",
            "gr": "el"
        },

        levelTrans: {
            "1": "green",
            "2": "yellow",
            "3": "orange",
            "4": "red",
        },

        uvScale: {
            "0": "Low",
            "1": "Low",
            "2": "Low",
            "3": "Moderate",
            "4": "Moderate",
            "5": "Moderate",
            "6": "High",
            "7": "High",
            "8": "Very High",
            "9": "Very High",
            "10": "Very High",
            "11": "Extreme",
        },

        moon: {
            "Last Quarter": 'modules/MMM-NOAA3/images/moon/thirdquarter.png',
            "New Moon": 'modules/MMM-NOAA3/images/moon/newmoon.png',
            "Waxing": 'modules/MMM-NOAA3/images/moon/waxingcrescent.png',
            "First Quarter": 'modules/MMM-NOAA3/images/moon/firstquarter.png',
            "Waxing Gibbous": 'modules/MMM-NOAA3/images/moon/waxinggibbous.png',
            "Full Moon": 'modules/MMM-NOAA3/images/moon/fullmoon.png',
            "Waning Gibbous": 'modules/MMM-NOAA3/images/moon/waninggibbous.png',
            "Waning Crescent": 'modules/MMM-NOAA3/images/moon/waningcrescent.png',
            "Waxing Crescent": 'modules/MMM-NOAA3/images/moon/waxingcrescent.png',
            "3rd Quarter": 'modules/MMM-NOAA3/images/moon/thirdquarter.png'
        }
    },


    getTranslations: function () {
        return {
            en: "translations/en.json",
            da: "translations/da.json",
            sv: "translations/sv.json",
            de: "translations/de.json",
            es: "translations/es.json",
            fr: "translations/fr.json",
            "zh-cn": "translations/zh_cn.json",
            nl: "translations/nl.json",
            nb: "translations/nb.json",
            it: "translations/it.json",
            gr: "translations/gr.json"
        };

    },

    scheduleUpdate: function () {
        setInterval(() => {
        }, this.config.updateInterval);
    },

    secondsToString: function (seconds) {
        var seconds = this.srss.day;

        var date = new Date(seconds * 1000);
        var hh = date.getUTCHours();
        var mm = date.getUTCMinutes();
        var ss = date.getSeconds();
        if (hh < 10) {
            hh = "0" + hh;
        }
        if (mm < 10) {
            mm = "0" + mm;
        }
        if (ss < 10) {
            ss = "0" + ss;
        }
        var t = hh + ":" + mm;
        return t;
    },

    getScripts: function () {
        return ['moment.js'];
    },

    getStyles: function () {
        if (this.config.css == "NOAA3") {
            return ["modules/MMM-NOAA3/css/MMM-NOAA3.css"];
        } else if (this.config.css == "NOAA2") {
            return ["modules/MMM-NOAA3/css/MMM-NOAA2.css"];
        } else if (this.config.css == "NOAA1") {
            return ["modules/MMM-NOAA3/css/MMM-NOAA1.css"];
        } else {
            return ["modules/MMM-NOAA3/css/MMM-NOAA4.css"];
        }
    },

    text: '',

    start: function () {
        Log.info("Starting module: " + this.name);
        this.text = this.translate("TEXT_PLACEHOLDER");
        this.sendSocketNotification('MMM-NOAA3', this.config);
        this.updateInterval = null;
        this.config.lang = this.config.lang || config.language; //automatically overrides and sets language :)
        this.config.units = this.config.units || config.units;
        var lang = this.config.langTrans[config.language];
        this.forecast = {};
        this.air = {};
        this.srss = {};
        this.amess = [];
        this.current = {};
        this.today = "";
        this.aqius = {};
        this.issue = {};
        this.activeItem = 0;
        this.rotateInterval = null;
        this.uvData = null;
        this.loaded = false;
    },

    getUVIndexLevel: function (uv) {
        if (uv >= 0 && uv < 3) {
            return { "fullName": "Low", "shortName": "Low", "color": "#558B2F" };
        } else if (uv >= 3 && uv < 6) {
            return { "fullName": "Moderate", "shortName": "Mod", "color": "#F9A825" };
        } else if (uv >= 6 && uv < 8) {
            return { "fullName": "High", "shortName": "High", "color": "#EF6C00" };
        } else if (uv >= 8 && uv < 11) {
            return { "fullName": "Very High", "shortName": "VHigh", "color": "#B71C1C" };
        } else if (uv >= 11) {
            return { "fullName": "Extreme", "shortName": "Extr", "color": "#6A1B9A" };
        } else {
            return { "fullName": "Invalid", "shortName": "Invalid", "color": "#a3a9b3" };
        }
    },



    socketNotificationReceived: function (notification, payload) {
        if (notification === "WEATHER_RESULT") {
            this.processWeather(payload);
        }
        if (notification === "SRSS_RESULT") {
            this.processSRSS(payload);
        }
        if (notification === "AIR_RESULT") {
            this.processAIR(payload);
        }
        if (notification === "ALERT_RESULT") {
            this.processALERT(payload);
        }
        if (notification === "MOON_RESULT") {
            this.processMOON(payload);
        }
        if (this.rotateInterval == null) {
            this.scheduleCarousel();
        }
        this.updateDom();

        this.config.updateInterval;
    },
    processMOON: function (data) {
        this.moon = data;
    },

    processAIR: function (data) {
        if (data && typeof data === "object" && data.air) {
            this.air = data.air;
        } else if (!this.air || this.air.aqius === undefined) {
            this.air = { aqius: "N/A" };
        }
    },
    processSRSS: function (data) {
        if (!data || typeof data !== "object") {
            return; // keep the last good sunrise/sunset
        }
        this.srss = data;
        srss = this.srss;
    },

    processWeather: function (data) {
        if (!data || typeof data !== "object" || !data.current) {
            Log.warn("MMM-NOAA3: no weather data this time, keeping the last good data");
            return;
        }
        this.current = data;
        var weather = this.current.current;
        icon = weather.icon;
        sunset = this.srss.sunset;
        this.sendNotification("WEATHER", { icon, sunset });
        this.loaded = true;

        if (this.current && this.current.uvForecast && this.current.uvForecast.length > 0) {
            this.processProviderUVForecast(this.current.uvForecast);
        } else if (this.config.UVIndexAccessToken) {
            this.fetchUVIndex();
        }
    },

    processProviderUVForecast: function (uvList) {
        if (!uvList || uvList.length === 0) return;

        this.uvData = {
            forecast: uvList.slice(0, 4).map(item => ({
                uv: typeof item.uv === "number" ? item.uv : 0,
                time: item.time,
                hour: item.hour || (item.time ? moment(item.time).format(config.timeFormat == 12 ? "h:mm" : "H:mm") : "")
            }))
        };
    },

    fetchUVIndex: function () {
        if (!this.config.UVIndexAccessToken || !this.config.userlat || !this.config.userlon) {
            return;
        }
        var url = "https://api.openuv.io/api/v1/forecast?lat=" + this.config.userlat + "&lng=" + this.config.userlon;
        var self = this;
        var UVIndexRequest = new XMLHttpRequest();
        UVIndexRequest.open("GET", url, true);
        UVIndexRequest.setRequestHeader("x-access-token", this.config.UVIndexAccessToken);
        UVIndexRequest.onreadystatechange = function () {
            if (this.readyState === 4) {
                if (this.status === 200) {
                    try {
                        self.processUVIndex(JSON.parse(this.response));
                        self.updateDom();
                    } catch (e) {
                        console.error("MMM-NOAA3: Failed to parse OpenUV payload", e);
                    }
                } else {
                    console.error("MMM-NOAA3: Error fetching OpenUV - status " + this.status);
                }
            }
        };
        UVIndexRequest.send();
    },

    processALERT: function (data) {
        this.issue = data.alerts;
        console.log(this.issue);
    },

    processUVIndex: function (data) {
        if (!data || !data.result) {
            console.log("Did not receive valid UV data");
            return;
        }

        const now = new Date();
        const forecastList = [];

        for (let i = 1; i <= 4; i++) {
            const targetTime = new Date(now.getTime() + i * 3600 * 1000);
            const targetISO = targetTime.toISOString().slice(0, 13);
            const match = data.result.find(it => it.uv_time && it.uv_time.slice(0, 13) === targetISO);

            const hourLabel = moment(targetTime).format(config.timeFormat == 12 ? "h:mm" : "H:mm");
            if (match) {
                forecastList.push({
                    uv: Math.round(match.uv * 100) / 100,
                    hour: hourLabel,
                    time: match.uv_time
                });
            } else {
                forecastList.push({
                    uv: 0,
                    hour: hourLabel,
                    time: targetTime.toISOString()
                });
            }
        }

        this.uvData = { forecast: forecastList };
        console.log("OpenUV Data processed:", this.uvData);
    },

    scheduleCarousel: function () {
        this.rotateInterval = setInterval(() => {
            this.activeItem++;
            this.updateDom();
        }, this.config.rotateInterval);
    },


    getDom: function () {

        var wrapper = document.createElement("div");
        if (!this.loaded) {
            wrapper.innerHTML = "Gathering your weather info..";
            wrapper.className = "bright small";
            return wrapper;
        }

        var current = this.current.current;
        //console.log(current);
        var d = new Date();
        var n = d.getHours();

        if (typeof current !== 'undefined') {
            var weather = current.weather;
            var weather_f = current.weather_f;
            var weather_c = current.weather_f;
            var icon = current.icon;
            var temp_f = current.temp_f;
            var temp_c = current.temp_c;
            var fctext = current.weather_f;
            var fctext_m = current.weather_f;
            var humid = current.humidity;
            var baro_in = current.pressure_in;
            var baro_mb = current.pressure_mb;
            var visibility = Math.round(current.visibility_mi);
            var UV = current.UV ? current.UV : 0;
            var wind_mph = Math.round(current.wind_mph);
            var wind_kph = Math.round(current.wind_kph);
        }
        //console.log('this is from NOAA3 '+weather);
        var cweat = document.createElement("div");
        cweat.classList.add("small", "bright", "floatl");
        cweat.style.maxWidth = "55%"; // long text ("Windy. Mostly sunny") wraps instead of pushing the icon off screen
        if (this.config.provider === 'openweather' && this.config.lang != 'en') {
            cweat.innerHTML = weather_f + "<br>";
        } else {
            cweat.innerHTML = weather + "<br>";
        }
        wrapper.appendChild(cweat);

        var curCon = document.createElement("div");
        curCon.classList.add("img");
        var isDay = (this.srss && this.srss.sunrise && this.srss.sunset)
            ? moment().isBetween(moment(this.srss.sunrise), moment(this.srss.sunset))
            : (n < 18 && n > 6);
        // Icons are 175px wide; at that size they ran off the screen next to longer text. 115px fits.
        var iconStyle = " style='width:115px;height:auto'";
        curCon.innerHTML = isDay ? "<img src='modules/MMM-NOAA3/images/" + icon + ".png'" + iconStyle + ">" : "<img src='modules/MMM-NOAA3/images/nt_" + icon + ".png'" + iconStyle + ">";
        wrapper.appendChild(curCon);


        function myFunction(id) {
            var x = document.getElementById(id);
            if (x.className.indexOf("w3-show") == -1) {
                x.className += " w3-show";
            } else {
                x.className = x.className.replace(" w3-show", "");
            }
        }

        var cur = document.createElement("div");
        cur.classList.add("tempf", "tooltip");
        var temper = config.units != "metric" ? cur.innerHTML = Math.round(temp_f) + "&deg;<span class='tooltiptext'>" + this.translate('Forecast') + ": " + fctext + "</span> " : Math.round(temp_c) + "&deg;<span class='tooltiptext'>" + this.translate('Forecast') + ": " + fctext + "</span> ";
        cur.innerHTML = `<div class="divTable">
          <div class="divTableBody">
        <div class="divTableRow">
            <div class="divTableHead"> </div> 
        </div>
		<div class="divTableRow"> 
                <div class="divTableCell2">${temper}</div>
            </div></div></div> `
        wrapper.appendChild(cur);

        var top = document.createElement('div');
        top.classList.add('topshow');
        var head2 = this.translate("Pressure");
        var head3 = this.translate("Visibility");
        if (current && current.pressure_mb === null) {
            // Provider has no pressure/visibility (BOM): show real values instead of placeholders
            head2 = this.translate("Feels");
            head3 = this.translate("Rain");
            var feels = config.units != "metric" ? current.feels_like_f : current.feels_like_c;
            var Baro = (feels === null || feels === undefined) ? "-" : feels + "&deg;";
            var Miles = (current.rain_chance === null || current.rain_chance === undefined) ? "-" : current.rain_chance + "%";
        } else {
            var Baro = config.units != "metric" ? baro_in + " inHg" : baro_mb;
            var Miles = config.units != "metric" ? visibility + " Mi" : (Math.round(visibility * 1.60934)) + " Km";
        }
        top.innerHTML =
            `<div class="divTable">
          <div class="divTableBody">
        <div class="divTableRow">
            <div class="divTableHead">${this.translate("Humidity")}</div>
            <div class="divTableHead">${head2}</div>
            <div class="divTableHead">${head3}</div>
        </div>
		
		<div class="divTableRow">
                <div class="divTableCell">${humid}</div>
                <div class="divTableCell">${Baro}</div>
                <div class="divTableCell">${Miles}</div>
            </div></div></div>`;
        top.addEventListener("click", () => hideit(thisTop));
        wrapper.appendChild(top);

        function hideit(thisTop) {
            top.style.display = "none";
        };

        srss = this.srss;
        var sunrise = srss.sunrise;
        var sunset = srss.sunset;
        var daylength = moment.utc(srss.day_length * 1000).format('HH:mm:ss');;
        var utcsunrise = moment.utc(sunrise).toDate();
        var utcsunset = moment.utc(sunset).toDate();
        var sunrise = config.timeFormat == 12 ? moment(utcsunrise).local().format("h:mm") : moment(utcsunrise).local().format("HH:mm");
        var sunset = config.timeFormat == 12 ? moment(utcsunset).local().format("h:mm") : moment(utcsunset).local().format("HH:mm");

        var nextDiv = document.createElement('div');
        nextDiv.innerHTML =
            `<div class="divTable">
   <div class="divTableBody">
   
      <div class="divTableRow">
         <div class="divTableHead">${this.translate("Rise")}</div>
         <div class="divTableHead">${this.translate("Hours of Light")}</div>
         <div class="divTableHead">${this.translate("Set")}</div>
      </div>
	 
      <div class="divTableRow">
         <div class="divTableCell">${sunrise}</div>
         <div class="divTableCell">${daylength}</div>
         <div class="divTableCell">${sunset}</div>
      </div>
   </div>
</div>`;
        wrapper.appendChild(nextDiv);

        var time = new Date();
        var g = time.getHours();
        var m = time.getMinutes();
        var fun = g + ":" + m;
        var done = moment(fun, ["h:mm A"]).format("HH:mm");
        var str1 = moment(sunrise, ["h:mm A"]).format("HH:mm");
        var str2 = moment(sunset, ["h:mm A"]).format("HH:mm");

        var ev1 = parseInt(moment().format("HH"), 10);
        var ev2 = parseInt(moment(srss.sunrise).format("HH"), 10);
        var ev3 = parseInt(moment(srss.sunset).format("HH"), 10);
        // console.log("Now :"+ev1 + " Rise: "+ ev2+" Set:  "+ev3);	
        var lastDiv = document.createElement('div');
        var level = this.air.aqius;
        if (typeof level === "number") {
            // US AQI colours: Good / Moderate / Unhealthy for sensitive groups / Unhealthy / Very unhealthy / Hazardous
            var aqiColor = level <= 50 ? "#558B2F" : level <= 100 ? "#F9A825" : level <= 150 ? "#EF6C00" : level <= 200 ? "#B71C1C" : level <= 300 ? "#6A1B9A" : "#4E342E";
            level = '<span style="color:' + aqiColor + '">' + level + '</span>';
        }
        /*this.air.aqius  > 0 && this.air.aqius <= 50 ? this.air.aqius + "<span class='CellComment'>" + this.translate('Excellent') + "</span>": 
        this.air.aqius > 50 && this.air.aqius <= 100 ? this.air.aqius + "<span class='CellComment'>" + this.translate('Good') + "</span>" :
        this.air.aqius > 100 && this.air.aqius <= 150 ? this.air.aqius + "<span class='CellComment'>" + this.translate('Lightly Polluted') + "</span>":
        this.air.aqius > 151 && this.air.aqius <= 200 ? this.air.aqius + "<span class='CellComment'>" + this.translate('Moderately Polluted') + "</span>":
        this.air.aqius > 201 && this.air.aqius <= 300 ? this.air.aqius + "<span class='CellComment'>" + this.translate('Heavily Polluted') + "</span>":
        this.air.aqius + "<span class='CellComment'>Severely Polluted</span></div>";	*/
        lastDiv.innerHTML =
            `<div class="divTable">
   <div class="divTableBody">
  
      <div class="divTableRow">
         <div class="divTableHead">AQI</div>
         <div class="divTableHead">${(ev1 >= ev2 && ev1 <= ev3) ? "UV" : this.translate("Night")}</div>
         <div class="divTableHead">${this.translate("Wind")}</div>
      </div>
	   
      <div class="divTableRow">
       <div class="divTableCell">${level}</div>
         <div class="divTableCell">${(ev1 >= ev2 && ev1 <= ev3) ? UV + " (UV)" : '<img src=' + (this.config.moon[this.moon] || '"modules/MMM-NOAA3/images/moon/newmoon.png"') + ' height="27px" width="27px">'}</div>
         <div class="divTableCell">${(config.units == "metric") ? wind_kph + " km/h" : wind_mph + " mph"}</div>
      </div>
   </div>
</div>`;
        wrapper.appendChild(lastDiv);

        //uv moon above//////////////////////////////////////////////////

        var forecast = this.current.forecast
        if (forecast != null) {

            var ForecastTable = document.createElement("table");
            ForecastTable.classList.add("table")
            ForecastTable.setAttribute('style', 'line-height: 20%;');

            var FCRow = document.createElement("tr");
            var jumpy = document.createElement("th");
            jumpy.setAttribute("colspan", 4);
            jumpy.classList.add("rheading");
            jumpy.innerHTML = this.translate("4 Day Forecast");
            FCRow.appendChild(jumpy);
            ForecastTable.appendChild(FCRow);

            var d = new Date();
            var weekday = new Array(7);
            weekday[0] = "Sun";
            weekday[1] = "Mon";
            weekday[2] = "Tue";
            weekday[3] = "Wed";
            weekday[4] = "Thu";
            weekday[5] = "Fri";
            weekday[6] = "Sat";

            var n = this.translate(weekday[d.getDay()]);


            var nextRow = document.createElement("tr");
            for (i = 0; i < forecast.length; i++) {
                var noaa = forecast[i];
                var wdshort = document.createElement("td");
                if (this.config.provider != "weatherunlocked") {
                    wdshort.classList.add("xsmall", "bright");
                    //wdshort.setAttribute("style", "padding:11px");
                } else {
                    wdshort.classList.add("dates", "bright");
                    wdshort.setAttribute("style", "padding:11px");
                }
                wdshort.innerHTML = (this.translate(noaa.date.weekday_short) == n) ? this.translate("Today") : this.translate(noaa.date.weekday_short);
                nextRow.appendChild(wdshort);
                ForecastTable.appendChild(nextRow);
            }

            var foreRow = document.createElement("tr");
            for (i = 0; i < this.current.forecast.length; i++) {
                var noaa = this.current.forecast[i];
                var fore = document.createElement("td");
                fore.setAttribute("colspan", "1");
                //fore.setAttribute('style','float: center');
                fore.classList.add("CellWithComment");
                if (noaa.date.weekday_short == n) {
                    fore.innerHTML = "<img src='modules/MMM-NOAA3/images/" + noaa.icon + ".png' height='22' width='28'>";
                } else {
                    fore.innerHTML = "<img src='modules/MMM-NOAA3/images/" + noaa.icon + ".png' height='22' width='28'><span class='CellComment'>" + noaa.desc + "</span>";
                }
                foreRow.appendChild(fore);
                ForecastTable.appendChild(foreRow);
            }

            var tempRow = document.createElement("tr");
            for (i = 0; i < this.current.forecast.length; i++) {
                var noaa = this.current.forecast[i];
                var temper = document.createElement("td");
                temper.setAttribute("colspan", "1");
                temper.classList.add("xsmall", "bright");
                var t = (config.units != "metric") ? noaa.high.fahrenheit : noaa.high.celsius;
                var l = (config.units != "metric") ? noaa.low.fahrenheit : noaa.low.celsius;
                var fmt = v => (v === null || v === undefined || isNaN(v)) ? "&ndash;" : Math.round(v);
                temper.innerHTML = fmt(t) + "/" + fmt(l);
                tempRow.appendChild(temper);
                ForecastTable.appendChild(tempRow);
            }

            wrapper.appendChild(ForecastTable);
        }

        // --- UV INDEX SECTION ---
        if (this.config.showUVForecast !== false && this.uvData && this.uvData.forecast && this.uvData.forecast.length > 0) {

            var uvTable = document.createElement("table");
            uvTable.classList.add("table");
            uvTable.setAttribute('style', 'line-height: normal; margin-top: 10px; width: 100%;');

            var FCRowUv = document.createElement("tr");
            var jumpyUv = document.createElement("th");
            jumpyUv.setAttribute("colspan", 4);
            jumpyUv.classList.add("rheading");
            jumpyUv.innerHTML = this.translate(this.config.uvForecastTitle || "4 Hour UV Forecast") || "4 Hour UV Forecast";
            FCRowUv.appendChild(jumpyUv);
            uvTable.appendChild(FCRowUv);

            // Build formatting arrays for the forecast (4 columns)
            var formatHours = [];
            var fcLevels = [];
            var fcColors = [];
            var fcVals = [];

            for (let i = 0; i < 4; i++) {
                let it = this.uvData.forecast[i];
                if (it) {
                    var inf = this.getUVIndexLevel(it.uv);
                    var hourDisplay = it.hour;
                    if (!hourDisplay && it.time) {
                        hourDisplay = moment(it.time).format(config.timeFormat == 12 ? "h:mm" : "H:mm");
                    }
                    if (!hourDisplay) {
                        var fd = new Date();
                        fd.setHours(fd.getHours() + (i + 1));
                        hourDisplay = moment(fd).format(config.timeFormat == 12 ? "h:mm" : "H:mm");
                    }
                    formatHours.push(hourDisplay);
                    fcLevels.push(inf.shortName);
                    fcColors.push(inf.color);
                    fcVals.push(it.uv);
                } else {
                    var fd = new Date();
                    fd.setHours(fd.getHours() + (i + 1));
                    var hourDisplay = moment(fd).format(config.timeFormat == 12 ? "h:mm" : "H:mm");
                    formatHours.push(hourDisplay);
                    var zeroInf = this.getUVIndexLevel(0);
                    fcLevels.push(zeroInf.shortName);
                    fcColors.push(zeroInf.color);
                    fcVals.push(0);
                }
            }

            // Row 1: Time Headers (4 columns)
            var nextRowUv = document.createElement("tr");
            for (let i = 0; i < 4; i++) {
                var thT = document.createElement("td");
                thT.classList.add("bright");
                thT.setAttribute("style", "font-size: 13px; font-weight: 600; padding: 2px 0;");
                thT.innerHTML = formatHours[i];
                nextRowUv.appendChild(thT);
            }
            uvTable.appendChild(nextRowUv);

            // Row 2: Colored Level Badges (4 columns)
            var rowLvlUv = document.createElement("tr");
            for (let i = 0; i < 4; i++) {
                var tdLvl = document.createElement("td");
                tdLvl.setAttribute("style", "padding: 2px 1px;");
                tdLvl.innerHTML = '<div style="background-color:' + fcColors[i] + '; color:#fff; border-radius:4px; padding:3px 0; font-size:13px; font-weight:bold; margin: 0 2px;">' + fcLevels[i] + '</div>';
                rowLvlUv.appendChild(tdLvl);
            }
            uvTable.appendChild(rowLvlUv);

            // Row 3: UV Values (4 columns)
            var rowValUv = document.createElement("tr");
            for (let i = 0; i < 4; i++) {
                var tdVal = document.createElement("td");
                tdVal.classList.add("bright");
                tdVal.setAttribute("style", "font-size: 18px; font-weight: bold; line-height: 120%; padding: 2px 0;");
                tdVal.innerHTML = fcVals[i];
                rowValUv.appendChild(tdVal);
            }
            uvTable.appendChild(rowValUv);

            wrapper.appendChild(uvTable);
        }
        // --- END UV INDEX SECTION ---

        //////////ALERT FOR DarkSKY ONLY////////////////////
        var issue = this.issue;
        if (typeof issue != 'undefined' || null) {
            var keys = Object.keys(this.issue);
            if (keys.length > 0) {
                if (this.activeItem >= keys.length) {
                    this.activeItem = 0;
                }
                var issue = this.issue[keys[this.activeItem]];

                var warning = document.createElement("div");
                warning.classList.add('advise');
                warning.innerHTML = "Weather Advisory<BR> Type: " + issue.severity;
                wrapper.appendChild(warning);

                var emer = document.createElement("div");
                emer.classList.add('warning', 'bright');
                var str2 = issue.description.replace(/(([^\s]+\s\s*){30})(.*)/, "$1…");
                emer.innerHTML = issue.title + "<span class='tooltiptext'>" + str2 + "</span> ";
                wrapper.appendChild(emer);

                var area = document.createElement("div");
                area.classList.add('areas');
                area.innerHTML = "Areas effected :<BR>";
                wrapper.appendChild(area);

                var counties = issue.regions;
                var list = document.createElement("div");
                list.classList.add('list');
                for (var i = 0; i < counties.length; i++) {
                    list.innerHTML += counties[i] + ",  ";
                }
                wrapper.appendChild(list);
            }
        }
        /////////////ALERT END///////////////////////////////////


        if (this.config.nupdate != false) {
            if (config.timeFormat == 12) {
                var doutput = moment().format("M.D.YYYY");
                var tinput = document.lastModified;
                var toutput = (moment(tinput.substring(10, 16), 'HH:mm').add(30, 'minutes').format('h:mm a'));
            } else {
                var doutput = moment().format("DD.MM.YYYY");
                var tinput = document.lastModified;
                var toutput = (moment(tinput.substring(10, 16), 'HH:mm').format('HH:mm'));
            }
            var x = this.config.updateInterval;
            var y = moment.utc(x).format('mm');
            var mod = document.createElement("div");
            mod.classList.add("xxsmall");
            mod.setAttribute('style', 'text-align: center;');
            mod.innerHTML = "<font color=yellow>[</font>Updated: " + doutput + " @ " + toutput + "<font color=yellow>]</font>";
            wrapper.appendChild(mod);
        }
        return wrapper;
    },
});