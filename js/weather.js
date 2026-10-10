// Scotia Fieldsport Log — weather module

const Weather = (() => {
  const CACHE_KEY = 'sfl_weather';
  const FORECAST_KEY = 'sfl_forecast';
  const CACHE_MINS = 30;

  function windDir(deg) {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  function weatherIcon(code) {
    if (code >= 200 && code < 300) return '⛈';
    if (code >= 300 && code < 400) return '🌦';
    if (code >= 500 && code < 600) return '🌧';
    if (code >= 600 && code < 700) return '❄️';
    if (code >= 700 && code < 800) return '🌫';
    if (code === 800) return '☀️';
    if (code === 801) return '🌤';
    if (code <= 804) return '☁️';
    return '🌡';
  }

  async function fetchCurrent() {
    // Return cached if fresh
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_MINS * 60000) return cached.data;
    } catch {}

    if (!WEATHER_CONFIG.apiKey || WEATHER_CONFIG.apiKey.startsWith('PASTE')) return null;

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${WEATHER_CONFIG.defaultLat}&lon=${WEATHER_CONFIG.defaultLon}&units=metric&appid=${WEATHER_CONFIG.apiKey}`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const d = await r.json();
      const data = {
        temp: Math.round(d.main.temp),
        feels: Math.round(d.main.feels_like),
        desc: d.weather[0].description,
        icon: weatherIcon(d.weather[0].id),
        wind: Math.round(d.wind.speed * 3.6), // m/s → km/h
        windDir: windDir(d.wind.deg || 0),
        humidity: d.main.humidity,
        code: d.weather[0].id
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      return data;
    } catch { return null; }
  }

  async function fetchForecast() {
    try {
      const cached = JSON.parse(localStorage.getItem(FORECAST_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_MINS * 60000) return cached.data;
    } catch {}

    if (!WEATHER_CONFIG.apiKey || WEATHER_CONFIG.apiKey.startsWith('PASTE')) return null;

    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${WEATHER_CONFIG.defaultLat}&lon=${WEATHER_CONFIG.defaultLon}&units=metric&cnt=40&appid=${WEATHER_CONFIG.apiKey}`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const d = await r.json();

      // Group by day — pick midday entry
      const days = {};
      d.list.forEach(item => {
        const date = item.dt_txt.split(' ')[0];
        const hour = parseInt(item.dt_txt.split(' ')[1]);
        if (!days[date] || Math.abs(hour - 12) < Math.abs((days[date].hour || 0) - 12)) {
          days[date] = { ...item, hour };
        }
      });

      const data = Object.entries(days).slice(0, 5).map(([date, item]) => ({
        date,
        dayLabel: new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        temp: Math.round(item.main.temp),
        desc: item.weather[0].description,
        icon: weatherIcon(item.weather[0].id),
        wind: Math.round(item.wind.speed * 3.6),
        windDir: windDir(item.wind.deg || 0)
      }));

      localStorage.setItem(FORECAST_KEY, JSON.stringify({ ts: Date.now(), data }));
      return data;
    } catch { return null; }
  }

  function formatForEntry(w) {
    if (!w) return '';
    return `${w.temp}°C, ${w.desc}, wind ${w.windDir} ${w.wind}km/h`;
  }

  // Render weather strip on main screen
  async function renderStrip() {
    const strip = document.getElementById('weatherStrip');
    if (!strip) return;
    const w = await fetchCurrent();
    if (!w) {
      strip.innerHTML = '<span class="weather-na">Weather unavailable — add OpenWeatherMap key in config.js</span>';
      strip.onclick = null;
      return;
    }
    strip.innerHTML = `
      <span class="w-icon">${w.icon}</span>
      <span class="w-temp">${w.temp}°C</span>
      <span class="w-desc">${w.desc}</span>
      <span class="w-wind">💨 ${w.windDir} ${w.wind} km/h</span>
      <span class="w-tap">▾ 5-day</span>
    `;
    strip.onclick = showForecast;
  }

  async function showForecast() {
    const days = await fetchForecast();
    if (!days) return;
    const rows = days.map(d => `
      <div class="forecast-row">
        <span class="fc-day">${d.dayLabel}</span>
        <span class="fc-icon">${d.icon}</span>
        <span class="fc-temp">${d.temp}°C</span>
        <span class="fc-desc">${d.desc}</span>
        <span class="fc-wind">💨 ${d.windDir} ${d.wind} km/h</span>
      </div>
    `).join('');
    Popup.show(`<h3>5-Day Forecast</h3><div class="forecast-list">${rows}</div>`);
  }

  return { fetchCurrent, fetchForecast, renderStrip, showForecast, formatForEntry };
})();
