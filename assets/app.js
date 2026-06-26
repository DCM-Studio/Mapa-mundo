"use strict";

const AUTH_USER = "admin-mapa";
const AUTH_PASS = "MapaDelMundo2026@!";
const AUTH_KEY = "mapa_mundo_authenticated";
const NASA_POWER_ENDPOINT = "https://power.larc.nasa.gov/api/temporal/daily/point";
const WORLD_ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const WEATHER_PARAMETERS = ["T2M", "RH2M", "PS"];
const MAX_CONCURRENT_REQUESTS = 6;

const METRICS = {
  temperature: {
    label: "Temperatura promedio",
    shortLabel: "Temp.",
    unit: "°C",
    field: "T2M",
    lowInput: "temperatureLow",
    highInput: "temperatureHigh",
  },
  pressure: {
    label: "Presión atmosférica",
    shortLabel: "Pres.",
    unit: "kPa",
    field: "PS",
    lowInput: "pressureLow",
    highInput: "pressureHigh",
  },
  humidity: {
    label: "Humedad promedio",
    shortLabel: "Hum.",
    unit: "%",
    field: "RH2M",
    lowInput: "humidityLow",
    highInput: "humidityHigh",
  },
  moon: {
    label: "Estado de la luna",
    shortLabel: "Luna",
    unit: "",
  },
};

const CITIES = [
  { name: "Santiago", country: "Chile", lat: -33.4489, lon: -70.6693 },
  { name: "Buenos Aires", country: "Argentina", lat: -34.6037, lon: -58.3816 },
  { name: "Sao Paulo", country: "Brasil", lat: -23.5558, lon: -46.6396 },
  { name: "Rio de Janeiro", country: "Brasil", lat: -22.9068, lon: -43.1729 },
  { name: "Lima", country: "Peru", lat: -12.0464, lon: -77.0428 },
  { name: "Bogota", country: "Colombia", lat: 4.711, lon: -74.0721 },
  { name: "Quito", country: "Ecuador", lat: -0.1807, lon: -78.4678 },
  { name: "Caracas", country: "Venezuela", lat: 10.4806, lon: -66.9036 },
  { name: "La Paz", country: "Bolivia", lat: -16.4897, lon: -68.1193 },
  { name: "Montevideo", country: "Uruguay", lat: -34.9011, lon: -56.1645 },
  { name: "Asuncion", country: "Paraguay", lat: -25.2637, lon: -57.5759 },
  { name: "Mexico City", country: "Mexico", lat: 19.4326, lon: -99.1332 },
  { name: "Guatemala City", country: "Guatemala", lat: 14.6349, lon: -90.5069 },
  { name: "Panama City", country: "Panama", lat: 8.9824, lon: -79.5199 },
  { name: "Havana", country: "Cuba", lat: 23.1136, lon: -82.3666 },
  { name: "New York", country: "Estados Unidos", lat: 40.7128, lon: -74.006 },
  { name: "Los Angeles", country: "Estados Unidos", lat: 34.0522, lon: -118.2437 },
  { name: "Chicago", country: "Estados Unidos", lat: 41.8781, lon: -87.6298 },
  { name: "Miami", country: "Estados Unidos", lat: 25.7617, lon: -80.1918 },
  { name: "Toronto", country: "Canada", lat: 43.6532, lon: -79.3832 },
  { name: "Vancouver", country: "Canada", lat: 49.2827, lon: -123.1207 },
  { name: "London", country: "Reino Unido", lat: 51.5072, lon: -0.1276 },
  { name: "Dublin", country: "Irlanda", lat: 53.3498, lon: -6.2603 },
  { name: "Paris", country: "Francia", lat: 48.8566, lon: 2.3522 },
  { name: "Madrid", country: "Espana", lat: 40.4168, lon: -3.7038 },
  { name: "Barcelona", country: "Espana", lat: 41.3874, lon: 2.1686 },
  { name: "Lisbon", country: "Portugal", lat: 38.7223, lon: -9.1393 },
  { name: "Berlin", country: "Alemania", lat: 52.52, lon: 13.405 },
  { name: "Rome", country: "Italia", lat: 41.9028, lon: 12.4964 },
  { name: "Milan", country: "Italia", lat: 45.4642, lon: 9.19 },
  { name: "Amsterdam", country: "Paises Bajos", lat: 52.3676, lon: 4.9041 },
  { name: "Brussels", country: "Belgica", lat: 50.8503, lon: 4.3517 },
  { name: "Zurich", country: "Suiza", lat: 47.3769, lon: 8.5417 },
  { name: "Vienna", country: "Austria", lat: 48.2082, lon: 16.3738 },
  { name: "Prague", country: "Chequia", lat: 50.0755, lon: 14.4378 },
  { name: "Warsaw", country: "Polonia", lat: 52.2297, lon: 21.0122 },
  { name: "Copenhagen", country: "Dinamarca", lat: 55.6761, lon: 12.5683 },
  { name: "Stockholm", country: "Suecia", lat: 59.3293, lon: 18.0686 },
  { name: "Oslo", country: "Noruega", lat: 59.9139, lon: 10.7522 },
  { name: "Helsinki", country: "Finlandia", lat: 60.1699, lon: 24.9384 },
  { name: "Athens", country: "Grecia", lat: 37.9838, lon: 23.7275 },
  { name: "Istanbul", country: "Turquia", lat: 41.0082, lon: 28.9784 },
  { name: "Moscow", country: "Rusia", lat: 55.7558, lon: 37.6173 },
  { name: "Kyiv", country: "Ucrania", lat: 50.4501, lon: 30.5234 },
  { name: "Cairo", country: "Egipto", lat: 30.0444, lon: 31.2357 },
  { name: "Casablanca", country: "Marruecos", lat: 33.5731, lon: -7.5898 },
  { name: "Algiers", country: "Argelia", lat: 36.7538, lon: 3.0588 },
  { name: "Tunis", country: "Tunez", lat: 36.8065, lon: 10.1815 },
  { name: "Lagos", country: "Nigeria", lat: 6.5244, lon: 3.3792 },
  { name: "Accra", country: "Ghana", lat: 5.6037, lon: -0.187 },
  { name: "Nairobi", country: "Kenia", lat: -1.2921, lon: 36.8219 },
  { name: "Addis Ababa", country: "Etiopia", lat: 8.9806, lon: 38.7578 },
  { name: "Johannesburg", country: "Sudafrica", lat: -26.2041, lon: 28.0473 },
  { name: "Cape Town", country: "Sudafrica", lat: -33.9249, lon: 18.4241 },
  { name: "Riyadh", country: "Arabia Saudita", lat: 24.7136, lon: 46.6753 },
  { name: "Dubai", country: "Emiratos Arabes Unidos", lat: 25.2048, lon: 55.2708 },
  { name: "Doha", country: "Qatar", lat: 25.2854, lon: 51.531 },
  { name: "Jerusalem", country: "Israel", lat: 31.7683, lon: 35.2137 },
  { name: "Tehran", country: "Iran", lat: 35.6892, lon: 51.389 },
  { name: "Karachi", country: "Pakistan", lat: 24.8607, lon: 67.0011 },
  { name: "Delhi", country: "India", lat: 28.6139, lon: 77.209 },
  { name: "Mumbai", country: "India", lat: 19.076, lon: 72.8777 },
  { name: "Bengaluru", country: "India", lat: 12.9716, lon: 77.5946 },
  { name: "Dhaka", country: "Bangladesh", lat: 23.8103, lon: 90.4125 },
  { name: "Colombo", country: "Sri Lanka", lat: 6.9271, lon: 79.8612 },
  { name: "Kathmandu", country: "Nepal", lat: 27.7172, lon: 85.324 },
  { name: "Bangkok", country: "Tailandia", lat: 13.7563, lon: 100.5018 },
  { name: "Hanoi", country: "Vietnam", lat: 21.0278, lon: 105.8342 },
  { name: "Ho Chi Minh City", country: "Vietnam", lat: 10.8231, lon: 106.6297 },
  { name: "Phnom Penh", country: "Camboya", lat: 11.5564, lon: 104.9282 },
  { name: "Kuala Lumpur", country: "Malasia", lat: 3.139, lon: 101.6869 },
  { name: "Singapore", country: "Singapur", lat: 1.3521, lon: 103.8198 },
  { name: "Jakarta", country: "Indonesia", lat: -6.2088, lon: 106.8456 },
  { name: "Manila", country: "Filipinas", lat: 14.5995, lon: 120.9842 },
  { name: "Hong Kong", country: "China", lat: 22.3193, lon: 114.1694 },
  { name: "Taipei", country: "Taiwan", lat: 25.033, lon: 121.5654 },
  { name: "Shanghai", country: "China", lat: 31.2304, lon: 121.4737 },
  { name: "Beijing", country: "China", lat: 39.9042, lon: 116.4074 },
  { name: "Seoul", country: "Corea del Sur", lat: 37.5665, lon: 126.978 },
  { name: "Tokyo", country: "Japon", lat: 35.6762, lon: 139.6503 },
  { name: "Osaka", country: "Japon", lat: 34.6937, lon: 135.5023 },
  { name: "Ulaanbaatar", country: "Mongolia", lat: 47.8864, lon: 106.9057 },
  { name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093 },
  { name: "Melbourne", country: "Australia", lat: -37.8136, lon: 144.9631 },
  { name: "Perth", country: "Australia", lat: -31.9523, lon: 115.8613 },
  { name: "Auckland", country: "Nueva Zelanda", lat: -36.8509, lon: 174.7645 },
  { name: "Honolulu", country: "Estados Unidos", lat: 21.3099, lon: -157.8581 },
  { name: "Reykjavik", country: "Islandia", lat: 64.1466, lon: -21.9426 },
];

const state = {
  countries: null,
  projection: null,
  path: null,
  zoomTransform: d3.zoomIdentity,
  selectedMetrics: [],
  selectedDate: "",
  weatherRows: [],
  currentRanges: {},
  activeAbortController: null,
};

const elements = {
  loginView: document.getElementById("loginView"),
  appView: document.getElementById("appView"),
  loginForm: document.getElementById("loginForm"),
  loginError: document.getElementById("loginError"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  logoutButton: document.getElementById("logoutButton"),
  dateInput: document.getElementById("dateInput"),
  metricToggles: [...document.querySelectorAll(".metric-toggle")],
  applyButton: document.getElementById("applyButton"),
  clearButton: document.getElementById("clearButton"),
  exportImageButton: document.getElementById("exportImageButton"),
  exportCsvButton: document.getElementById("exportCsvButton"),
  statusText: document.getElementById("statusText"),
  loadProgress: document.getElementById("loadProgress"),
  mapFrame: document.getElementById("mapFrame"),
  svg: d3.select("#worldMap"),
  tooltip: document.getElementById("cityTooltip"),
  legend: document.getElementById("legend"),
  mapTitle: document.getElementById("mapTitle"),
  mapKicker: document.getElementById("mapKicker"),
};

if (!window.d3 || !window.topojson) {
  elements.statusText.textContent =
    "No se pudieron cargar las librerías del mapa. Revisa conexión a internet o empaqueta los vendors localmente.";
  throw new Error("Missing D3 or TopoJSON dependency.");
}

const rootGroup = elements.svg.append("g").attr("id", "mapRoot");
const countryGroup = rootGroup.append("g").attr("id", "countries");
const areaGroup = rootGroup.append("g").attr("id", "metricAreas");
const cityGroup = rootGroup.append("g").attr("id", "cityMarkers");
const labelGroup = rootGroup.append("g").attr("id", "cityLabels");

initialize();

function initialize() {
  setDefaultDate();
  wireEvents();
  setAuthenticated(sessionStorage.getItem(AUTH_KEY) === "true");
  loadWorldMap();
}

function wireEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.applyButton.addEventListener("click", applySettings);
  elements.clearButton.addEventListener("click", clearMap);
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.exportImageButton.addEventListener("click", exportImage);
  window.addEventListener("resize", debounce(renderMap, 160));

  const zoom = d3
    .zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
      state.zoomTransform = event.transform;
      rootGroup.attr("transform", state.zoomTransform);
    });

  elements.svg.call(zoom);
}

function handleLogin(event) {
  event.preventDefault();
  const userOk = elements.username.value.trim() === AUTH_USER;
  const passOk = elements.password.value === AUTH_PASS;

  if (!userOk || !passOk) {
    elements.loginError.textContent = "Usuario o contraseña incorrectos.";
    return;
  }

  sessionStorage.setItem(AUTH_KEY, "true");
  elements.loginForm.reset();
  elements.loginError.textContent = "";
  setAuthenticated(true);
}

function handleLogout() {
  sessionStorage.removeItem(AUTH_KEY);
  clearMap();
  setAuthenticated(false);
}

function setAuthenticated(isAuthenticated) {
  elements.loginView.hidden = isAuthenticated;
  elements.appView.hidden = !isAuthenticated;

  if (isAuthenticated) {
    requestAnimationFrame(renderMap);
  }
}

function setDefaultDate() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  const isoDate = date.toISOString().slice(0, 10);
  elements.dateInput.value = isoDate;
  elements.dateInput.max = new Date().toISOString().slice(0, 10);
}

async function loadWorldMap() {
  try {
    setStatus("Cargando base cartográfica...", 0.05);
    const response = await fetch(WORLD_ATLAS_URL);
    if (!response.ok) throw new Error(`No se pudo cargar el mapa (${response.status}).`);
    const topology = await response.json();
    state.countries = topojson.feature(topology, topology.objects.countries);
    renderMap();
    setStatus("Mapa listo. Selecciona fecha y datos para aplicar.", 0);
  } catch (error) {
    setStatus(`Error cargando mapa: ${error.message}`, 0);
  }
}

function renderMap() {
  const bounds = elements.mapFrame.getBoundingClientRect();
  const width = Math.max(320, Math.floor(bounds.width));
  const height = Math.max(420, Math.floor(bounds.height));

  elements.svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
  elements.svg
    .selectAll("rect#mapBackground")
    .data([null])
    .join("rect")
    .attr("id", "mapBackground")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#d9e7ee");

  state.projection = d3.geoNaturalEarth1().fitExtent(
    [
      [18, 18],
      [width - 18, height - 18],
    ],
    { type: "Sphere" },
  );
  state.path = d3.geoPath(state.projection);

  if (state.countries) {
    countryGroup
      .selectAll("path")
      .data(state.countries.features)
      .join("path")
      .attr("class", "country")
      .attr("d", state.path)
      .attr("fill", "#f7f5ec")
      .attr("stroke", "#bec8c9")
      .attr("stroke-width", 0.45);
  }

  redrawDataLayers();
}

async function applySettings() {
  if (!state.countries) {
    setStatus("El mapa todavía se está cargando.", 0);
    return;
  }

  const date = elements.dateInput.value;
  const selectedMetrics = getSelectedMetrics();

  if (!date) {
    setStatus("Selecciona una fecha válida.", 0);
    return;
  }

  if (!selectedMetrics.length) {
    setStatus("Selecciona al menos un dato para mostrar.", 0);
    return;
  }

  state.selectedDate = date;
  state.selectedMetrics = selectedMetrics;
  state.weatherRows = [];
  state.currentRanges = {};
  setBusy(true);
  areaGroup.selectAll("*").remove();
  cityGroup.selectAll("*").remove();
  labelGroup.selectAll("*").remove();

  const needsWeather = selectedMetrics.some((metric) => metric !== "moon");
  const moon = getMoonPhase(date);

  try {
    if (state.activeAbortController) {
      state.activeAbortController.abort();
    }

    state.activeAbortController = new AbortController();
    const weatherRows = needsWeather
      ? await fetchWeatherForCities(date, state.activeAbortController.signal)
      : CITIES.map((city) => ({ city, values: {}, moon }));

    state.weatherRows = weatherRows.map((row) => ({
      ...row,
      moon,
    }));

    computeRanges();
    redrawDataLayers();
    updateLegend();
    updateTitle();
    setStatus(`Datos cargados para ${state.weatherRows.length} ciudades.`, 1);
  } catch (error) {
    if (error.name !== "AbortError") {
      setStatus(`No se pudieron cargar todos los datos: ${error.message}`, 0);
    }
  } finally {
    setBusy(false);
  }
}

async function fetchWeatherForCities(date, signal) {
  const rows = [];
  let completed = 0;
  const tasks = CITIES.map((city) => async () => {
    let values = { T2M: null, RH2M: null, PS: null };
    let error = null;

    try {
      values = await fetchCityWeather(city, date, signal);
    } catch (cityError) {
      if (cityError.name === "AbortError") throw cityError;
      error = cityError.message;
    }

    completed += 1;
    setStatus(`Cargando NASA POWER: ${completed}/${CITIES.length} ciudades...`, completed / CITIES.length);
    rows.push({ city, values, error });
  });

  await runLimited(tasks, MAX_CONCURRENT_REQUESTS);
  return rows.sort((a, b) => a.city.name.localeCompare(b.city.name));
}

async function runLimited(tasks, limit) {
  const executing = new Set();

  for (const task of tasks) {
    const promise = task().finally(() => executing.delete(promise));
    executing.add(promise);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

async function fetchCityWeather(city, date, signal) {
  const ymd = date.replaceAll("-", "");
  const url = new URL(NASA_POWER_ENDPOINT);
  url.searchParams.set("parameters", WEATHER_PARAMETERS.join(","));
  url.searchParams.set("community", "AG");
  url.searchParams.set("longitude", city.lon);
  url.searchParams.set("latitude", city.lat);
  url.searchParams.set("start", ymd);
  url.searchParams.set("end", ymd);
  url.searchParams.set("format", "JSON");
  url.searchParams.set("time-standard", "UTC");

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`NASA POWER respondió ${response.status} para ${city.name}.`);
  }

  const payload = await response.json();
  const parameters = payload?.properties?.parameter || {};
  return {
    T2M: normalizeValue(parameters.T2M?.[ymd]),
    RH2M: normalizeValue(parameters.RH2M?.[ymd]),
    PS: normalizeValue(parameters.PS?.[ymd]),
  };
}

function normalizeValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= -900) return null;
  return parsed;
}

function computeRanges() {
  for (const metricKey of ["temperature", "pressure", "humidity"]) {
    const field = METRICS[metricKey].field;
    const values = state.weatherRows
      .map((row) => row.values[field])
      .filter((value) => Number.isFinite(value));

    state.currentRanges[metricKey] = values.length
      ? { min: Math.min(...values), max: Math.max(...values) }
      : { min: 0, max: 1 };
  }
}

function redrawDataLayers() {
  if (!state.projection || !state.weatherRows.length) {
    return;
  }

  const selectedWeatherMetrics = state.selectedMetrics.filter((metric) => metric !== "moon");
  areaGroup.selectAll("*").remove();

  selectedWeatherMetrics.forEach((metricKey, metricIndex) => {
    const metric = METRICS[metricKey];
    const range = state.currentRanges[metricKey];

    areaGroup
      .selectAll(`circle.${metricKey}`)
      .data(state.weatherRows)
      .join("circle")
      .attr("class", `metric-area ${metricKey}`)
      .attr("cx", (row) => project(row.city)[0] + metricIndex * 2)
      .attr("cy", (row) => project(row.city)[1] + metricIndex * 2)
      .attr("r", (row) => areaRadius(row, metricKey))
      .attr("fill", (row) => metricColor(metricKey, row.values[metric.field], range))
      .attr("opacity", (row) => (Number.isFinite(row.values[metric.field]) ? 0.38 : 0));
  });

  if (state.selectedMetrics.includes("moon")) {
    areaGroup
      .selectAll("circle.moon")
      .data(state.weatherRows)
      .join("circle")
      .attr("class", "metric-area moon")
      .attr("cx", (row) => project(row.city)[0])
      .attr("cy", (row) => project(row.city)[1])
      .attr("r", 8)
      .attr("fill", document.getElementById("moonColor").value)
      .attr("opacity", 0.36);
  }

  cityGroup
    .selectAll("circle")
    .data(state.weatherRows)
    .join("circle")
    .attr("class", "city-dot")
    .attr("cx", (row) => project(row.city)[0])
    .attr("cy", (row) => project(row.city)[1])
    .attr("r", 3.4)
    .on("mousemove", handleTooltipMove)
    .on("mouseleave", hideTooltip);

  labelGroup
    .selectAll("text")
    .data(state.weatherRows)
    .join("text")
    .attr("class", "city-label")
    .attr("x", (row) => project(row.city)[0] + 6)
    .attr("y", (row) => project(row.city)[1] - 7)
    .text((row) => compactLabel(row));
}

function project(city) {
  return state.projection([city.lon, city.lat]);
}

function areaRadius(row, metricKey) {
  const metric = METRICS[metricKey];
  const value = row.values[metric.field];
  const range = state.currentRanges[metricKey];
  if (!Number.isFinite(value)) return 0;
  const normalized = normalizeToRange(value, range);
  return 12 + normalized * 15;
}

function metricColor(metricKey, value, range) {
  if (!Number.isFinite(value)) return "transparent";
  const metric = METRICS[metricKey];
  const low = document.getElementById(metric.lowInput).value;
  const high = document.getElementById(metric.highInput).value;
  return d3.interpolateRgb(low, high)(normalizeToRange(value, range));
}

function normalizeToRange(value, range) {
  if (!range || range.max === range.min) return 0.5;
  return Math.max(0, Math.min(1, (value - range.min) / (range.max - range.min)));
}

function compactLabel(row) {
  const parts = [row.city.name];

  for (const metricKey of state.selectedMetrics) {
    if (metricKey === "moon") {
      parts.push(row.moon.label);
      continue;
    }

    const metric = METRICS[metricKey];
    const value = row.values[metric.field];
    if (Number.isFinite(value)) {
      parts.push(`${metric.shortLabel} ${formatNumber(value)}${metric.unit}`);
    }
  }

  return parts.join(" · ");
}

function handleTooltipMove(event, row) {
  elements.tooltip.hidden = false;
  elements.tooltip.style.left = `${event.clientX + 14}px`;
  elements.tooltip.style.top = `${event.clientY + 14}px`;
  elements.tooltip.innerHTML = tooltipHtml(row);
}

function hideTooltip() {
  elements.tooltip.hidden = true;
}

function tooltipHtml(row) {
  const lines = state.selectedMetrics.map((metricKey) => {
    if (metricKey === "moon") return `<div>${METRICS.moon.label}: ${row.moon.label}</div>`;
    const metric = METRICS[metricKey];
    const value = row.values[metric.field];
    const output = Number.isFinite(value) ? `${formatNumber(value)} ${metric.unit}` : "Sin dato";
    return `<div>${metric.label}: ${output}</div>`;
  });

  return `<strong>${row.city.name}, ${row.city.country}</strong>${lines.join("")}`;
}

function updateLegend() {
  elements.legend.innerHTML = "";

  state.selectedMetrics.forEach((metricKey) => {
    const item = document.createElement("span");
    item.className = "legend-item";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";

    if (metricKey === "moon") {
      swatch.style.background = document.getElementById("moonColor").value;
    } else {
      const metric = METRICS[metricKey];
      swatch.style.background = `linear-gradient(90deg, ${document.getElementById(metric.lowInput).value}, ${
        document.getElementById(metric.highInput).value
      })`;
    }

    item.append(swatch, METRICS[metricKey].shortLabel);
    elements.legend.append(item);
  });
}

function updateTitle() {
  const date = formatDateForUi(state.selectedDate);
  elements.mapKicker.textContent = `${date} · ${state.weatherRows.length} ciudades`;
  elements.mapTitle.textContent = state.selectedMetrics.map((metric) => METRICS[metric].label).join(" + ");
}

function getSelectedMetrics() {
  return elements.metricToggles.filter((toggle) => toggle.checked).map((toggle) => toggle.value);
}

function clearMap() {
  if (state.activeAbortController) {
    state.activeAbortController.abort();
  }

  state.selectedMetrics = [];
  state.selectedDate = "";
  state.weatherRows = [];
  state.currentRanges = {};
  areaGroup.selectAll("*").remove();
  cityGroup.selectAll("*").remove();
  labelGroup.selectAll("*").remove();
  elements.legend.innerHTML = "";
  elements.mapKicker.textContent = "Sin datos cargados";
  elements.mapTitle.textContent = "Mapa oficial de referencia mundial";
  hideTooltip();
  setStatus("Mapa limpio.", 0);
}

function exportCsv() {
  if (!state.weatherRows.length) {
    setStatus("No hay datos cargados para exportar.", 0);
    return;
  }

  const header = [
    "fecha",
    "ciudad",
    "pais",
    "latitud",
    "longitud",
    "temperatura_promedio_c",
    "humedad_promedio_pct",
    "presion_atmosferica_kpa",
    "fase_lunar",
    "fuente_meteorologica",
  ];

  const rows = state.weatherRows.map((row) => [
    state.selectedDate,
    row.city.name,
    row.city.country,
    row.city.lat,
    row.city.lon,
    csvValue(row.values.T2M),
    csvValue(row.values.RH2M),
    csvValue(row.values.PS),
    row.moon.label,
    "NASA POWER Daily API",
  ]);

  downloadBlob([header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n"), {
    type: "text/csv;charset=utf-8",
    filename: `mapa-mundo-${state.selectedDate}.csv`,
  });
}

async function exportImage() {
  if (!state.countries) {
    setStatus("El mapa todavía no está listo para exportar.", 0);
    return;
  }

  const svgNode = document.getElementById("worldMap");
  const clone = svgNode.cloneNode(true);
  const width = svgNode.viewBox.baseVal.width || svgNode.clientWidth;
  const height = svgNode.viewBox.baseVal.height || svgNode.clientHeight;

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    .country{fill:#f7f5ec;stroke:#bec8c9;stroke-width:.45}
    .metric-area{mix-blend-mode:multiply;opacity:.38}
    .city-dot{fill:#102b35;stroke:#fff;stroke-width:1.15}
    .city-label{paint-order:stroke;stroke:rgba(255,255,255,.92);stroke-width:4px;fill:#102b35;font-size:10px;font-weight:800;font-family:Arial,sans-serif}
  `;
  clone.insertBefore(style, clone.firstChild);

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext("2d");
    context.fillStyle = "#d9e7ee";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setStatus("No se pudo generar la imagen.", 0);
        return;
      }
      downloadBlob(blob, {
        type: "image/png",
        filename: `mapa-mundo-${state.selectedDate || "sin-datos"}.png`,
      });
    }, "image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function downloadBlob(content, { type, filename }) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function csvValue(value) {
  return Number.isFinite(value) ? value : "";
}

function setStatus(message, progress) {
  elements.statusText.textContent = message;
  elements.loadProgress.value = progress;
}

function setBusy(isBusy) {
  elements.applyButton.disabled = isBusy;
  elements.clearButton.disabled = isBusy;
}

function formatNumber(value) {
  return Number(value).toLocaleString("es-CL", {
    maximumFractionDigits: 1,
  });
}

function formatDateForUi(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getMoonPhase(date) {
  const selected = new Date(`${date}T12:00:00Z`).getTime();
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const synodicMonthMs = 29.530588853 * 24 * 60 * 60 * 1000;
  const age = ((selected - knownNewMoon) % synodicMonthMs + synodicMonthMs) % synodicMonthMs;
  const fraction = age / synodicMonthMs;

  if (fraction < 0.03 || fraction >= 0.97) return { label: "Luna nueva", fraction };
  if (fraction < 0.22) return { label: "Creciente", fraction };
  if (fraction < 0.28) return { label: "Cuarto creciente", fraction };
  if (fraction < 0.47) return { label: "Gibosa creciente", fraction };
  if (fraction < 0.53) return { label: "Luna llena", fraction };
  if (fraction < 0.72) return { label: "Gibosa menguante", fraction };
  if (fraction < 0.78) return { label: "Cuarto menguante", fraction };
  return { label: "Menguante", fraction };
}

function debounce(callback, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}
