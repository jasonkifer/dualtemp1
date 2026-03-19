// Dual Temp Weather Widget for Scriptable
// Shows temperature in both Fahrenheit and Celsius
// Uses Open-Meteo API (free, no API key needed)

// --- Configuration ---
const FALLBACK_LAT = 37.4563;
const FALLBACK_LON = 126.7052;
const FALLBACK_NAME = "Incheon";

// --- Weather code mappings ---
const conditionNames = {
  0: "Clear", 1: "Mostly Clear", 2: "Partly Cloudy", 3: "Overcast",
  45: "Foggy", 48: "Rime Fog",
  51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
  56: "Freezing Drizzle", 57: "Freezing Drizzle",
  61: "Light Rain", 63: "Rain", 65: "Heavy Rain",
  66: "Freezing Rain", 67: "Freezing Rain",
  71: "Light Snow", 73: "Snow", 75: "Heavy Snow", 77: "Snow Grains",
  80: "Light Showers", 81: "Showers", 82: "Heavy Showers",
  85: "Snow Showers", 86: "Snow Showers",
  95: "Thunderstorm", 96: "Thunderstorm", 99: "Severe Storm"
};

// Map weather codes to SF Symbols
function weatherSymbol(code, isNight) {
  if (code === 0) return isNight ? "moon.stars.fill" : "sun.max.fill";
  if (code === 1) return isNight ? "moon.fill" : "sun.min.fill";
  if (code === 2) return isNight ? "cloud.moon.fill" : "cloud.sun.fill";
  if (code === 3) return "cloud.fill";
  if (code >= 45 && code <= 48) return "cloud.fog.fill";
  if (code >= 51 && code <= 57) return "cloud.drizzle.fill";
  if (code >= 61 && code <= 62) return "cloud.rain.fill";
  if (code >= 63 && code <= 67) return "cloud.heavyrain.fill";
  if (code >= 71 && code <= 77) return "cloud.snow.fill";
  if (code >= 80 && code <= 82) return "cloud.rain.fill";
  if (code >= 85 && code <= 86) return "cloud.snow.fill";
  if (code >= 95) return "cloud.bolt.fill";
  return "cloud.fill";
}

// SF Symbol color based on weather type
function symbolColor(code, isNight) {
  if (code === 0 && isNight) return new Color("#FFD93D");
  if (code === 0 || code === 1) return new Color("#FFD93D");
  if (code === 2) return new Color("#FFD93D");
  if (code === 3) return new Color("#C8D6E5");
  if (code >= 45 && code <= 48) return new Color("#C8D6E5");
  if (code >= 71 && code <= 77) return new Color("#DBEAFE");
  if (code >= 85 && code <= 86) return new Color("#DBEAFE");
  if (code >= 95) return new Color("#FFD93D");
  return new Color("#7CB3F2");
}

// --- Helpers ---
const cToF = c => Math.round((c * 9 / 5) + 32);

function formatHour(isoStr) {
  const d = new Date(isoStr);
  const h = d.getHours();
  if (h === 0) return "12AM";
  if (h === 12) return "12PM";
  return h > 12 ? (h - 12) + "PM" : h + "AM";
}

function formatDate(date) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

// --- Get location ---
async function getLocation() {
  try {
    Location.setAccuracyToThreeKilometers();
    const loc = await Location.current();
    let name = FALLBACK_NAME;
    try {
      const geo = await Location.reverseGeocode(loc.latitude, loc.longitude);
      if (geo && geo.length > 0) {
        name = geo[0].locality || geo[0].city || geo[0].administrativeArea || FALLBACK_NAME;
      }
    } catch (e) {
      // Reverse geocode failed, use fallback name
    }
    return { lat: loc.latitude, lon: loc.longitude, name };
  } catch (e) {
    return { lat: FALLBACK_LAT, lon: FALLBACK_LON, name: FALLBACK_NAME };
  }
}

// --- Fetch weather ---
async function fetchWeather() {
  const loc = await getLocation();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weather_code,is_day&timezone=auto&forecast_days=2`;
  const req = new Request(url);
  const d = await req.loadJSON();

  // Find current hour index using local time
  const now = new Date();
  const localISO = now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0") + "T" +
    String(now.getHours()).padStart(2, "0");
  let startIdx = d.hourly.time.findIndex(t => t.startsWith(localISO));
  if (startIdx === -1) startIdx = 0;

  const forecast = [];
  for (let i = 0; i < 6 && (startIdx + i) < d.hourly.time.length; i++) {
    const idx = startIdx + i;
    forecast.push({
      time: i === 0 ? "Now" : formatHour(d.hourly.time[idx]),
      tempF: cToF(d.hourly.temperature_2m[idx]),
      code: d.hourly.weather_code[idx],
      isNight: !d.hourly.is_day[idx]
    });
  }

  return {
    tempC: Math.round(d.current.temperature_2m),
    tempF: cToF(d.current.temperature_2m),
    code: d.current.weather_code,
    isDay: d.current.is_day,
    condition: conditionNames[d.current.weather_code] || "Unknown",
    hiF: cToF(d.daily.temperature_2m_max[0]),
    loF: cToF(d.daily.temperature_2m_min[0]),
    location: loc.name,
    forecast,
    date: formatDate(now)
  };
}

// --- Build Widget ---
async function createWidget() {
  const data = await fetchWeather();
  const w = new ListWidget();

  // Background gradient (iOS weather style)
  const gradient = new LinearGradient();
  gradient.locations = [0, 0.3, 0.6, 1];
  gradient.colors = [
    new Color("#4A9BE8"),
    new Color("#3A7BD5"),
    new Color("#5B8FCF"),
    new Color("#7BACD8")
  ];
  w.backgroundGradient = gradient;
  w.setPadding(12, 14, 10, 14);

  // === TOP ROW: Location (left) / Date (right) ===
  const topRow = w.addStack();
  topRow.layoutHorizontally();
  topRow.centerAlignContent();

  const locationText = topRow.addText(data.location + " ↗");
  locationText.font = Font.semiboldSystemFont(15);
  locationText.textColor = Color.white();
  locationText.lineLimit = 1;

  topRow.addSpacer();

  const dateText = topRow.addText(data.date);
  dateText.font = Font.semiboldSystemFont(14);
  dateText.textColor = Color.white();
  dateText.lineLimit = 1;

  w.addSpacer(4);

  // === MIDDLE ROW: Temps (left) / Condition + H/L (right) ===
  const midRow = w.addStack();
  midRow.layoutHorizontally();
  midRow.bottomAlignContent();

  // Left side: temperatures
  const tempStack = midRow.addStack();
  tempStack.layoutHorizontally();
  tempStack.bottomAlignContent();

  const fText = tempStack.addText(`${data.tempF}°`);
  fText.font = Font.lightSystemFont(46);
  fText.textColor = Color.white();
  fText.minimumScaleFactor = 0.7;

  tempStack.addSpacer(6);

  const cText = tempStack.addText(`${data.tempC}°C`);
  cText.font = Font.lightSystemFont(20);
  cText.textColor = new Color("#FFFFFF", 0.6);
  cText.minimumScaleFactor = 0.7;

  midRow.addSpacer();

  // Right side: condition + high/low
  const condStack = midRow.addStack();
  condStack.layoutVertically();
  condStack.bottomAlignContent();

  const condText = condStack.addText(data.condition);
  condText.font = Font.mediumSystemFont(13);
  condText.textColor = new Color("#FFFFFF", 0.9);
  condText.rightAlignText();
  condText.lineLimit = 1;

  condStack.addSpacer(2);

  const hiLoText = condStack.addText(`H:${data.hiF}°  L:${data.loF}°`);
  hiLoText.font = Font.regularSystemFont(11);
  hiLoText.textColor = new Color("#FFFFFF", 0.7);
  hiLoText.rightAlignText();

  condStack.addSpacer(6);

  w.addSpacer();

  // === DIVIDER ===
  const dividerStack = w.addStack();
  dividerStack.layoutHorizontally();
  dividerStack.addSpacer();
  const divider = dividerStack.addImage(createDividerImage());
  divider.imageSize = new Size(330, 1);
  divider.tintColor = new Color("#FFFFFF", 0.2);
  dividerStack.addSpacer();

  w.addSpacer(6);

  // === BOTTOM ROW: Hourly Forecast ===
  const forecastRow = w.addStack();
  forecastRow.layoutHorizontally();
  forecastRow.centerAlignContent();

  for (let i = 0; i < data.forecast.length; i++) {
    const f = data.forecast[i];

    const col = forecastRow.addStack();
    col.layoutVertically();
    col.centerAlignContent();
    col.size = new Size(0, 0);

    // Time label
    const timeLabel = col.addText(f.time);
    timeLabel.font = f.time === "Now" ? Font.boldSystemFont(10) : Font.semiboldSystemFont(10);
    timeLabel.textColor = f.time === "Now" ? Color.white() : new Color("#FFFFFF", 0.8);
    timeLabel.centerAlignText();

    col.addSpacer(4);

    // Weather icon
    const sym = SFSymbol.named(weatherSymbol(f.code, f.isNight));
    sym.applyFont(Font.systemFont(14));
    const iconImg = col.addImage(sym.image);
    iconImg.imageSize = new Size(20, 20);
    iconImg.tintColor = symbolColor(f.code, f.isNight);
    iconImg.centerAlignImage();

    col.addSpacer(4);

    // Temperature
    const tempLabel = col.addText(`${f.tempF}°`);
    tempLabel.font = Font.mediumSystemFont(12);
    tempLabel.textColor = Color.white();
    tempLabel.centerAlignText();

    if (i < data.forecast.length - 1) {
      forecastRow.addSpacer();
    }
  }

  return w;
}

// Create a 1px tall divider image
function createDividerImage() {
  const ctx = new DrawContext();
  ctx.size = new Size(330, 1);
  ctx.opaque = false;
  ctx.setFillColor(Color.white());
  ctx.fillRect(new Rect(0, 0, 330, 1));
  return ctx.getImage();
}

// --- Run ---
const widget = await createWidget();

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}

Script.complete();
