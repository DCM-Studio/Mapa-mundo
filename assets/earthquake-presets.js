"use strict";

(() => {
  const USGS_ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query";
  const select = document.getElementById("earthquakePresetSelect");
  const dateInput = document.getElementById("dateInput");
  const statusText = document.getElementById("statusText");
  const progress = document.getElementById("loadProgress");
  const exportCsvButton = document.getElementById("exportCsvButton");
  const NASA_POWER_ENDPOINT = "https://power.larc.nasa.gov/api/temporal/daily/point";
  const PLATE_BOUNDARIES_URL =
    "https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json";
  const WEATHER_START_DATE = "1981-01-01";
  const WEATHER_PARAMETERS = ["T2M", "RH2M", "PS"];
  const NEAR_PLATE_LIMIT_KM = 300;

  if (!select || !dateInput) {
    return;
  }

  let applyingPreset = false;
  const catalogExportButton = createCatalogExportButton();

  select.addEventListener("change", () => {
    const option = select.selectedOptions[0];
    const date = option?.dataset.date || "";

    if (!date) {
      return;
    }

    applyingPreset = true;
    dateInput.value = date;
    dateInput.dispatchEvent(new Event("change", { bubbles: true }));
    applyingPreset = false;

    if (statusText) {
      statusText.textContent = `Fecha seleccionada desde terremoto USGS: ${option.textContent}.`;
    }
  });

  dateInput.addEventListener("change", () => {
    if (applyingPreset) {
      return;
    }

    const matchingOption = Array.from(select.options).find((option) => option.dataset.date === dateInput.value);
    select.value = matchingOption ? matchingOption.value : "";
  });

  loadPresets();

  catalogExportButton?.addEventListener("click", exportCatalogCsv);

  async function loadPresets() {
    setPlaceholder("Cargando terremotos M7+ desde 1900...");

    try {
      const payload = await fetchLatestEarthquakes();
      const events = (payload.features || []).map(normalizeFeature).filter(Boolean);

      if (!events.length) {
        setPlaceholder("Sin terremotos M7+ disponibles en USGS");
        return;
      }

      renderOptions(events);
    } catch (error) {
      console.error(error);
      setPlaceholder("No se pudieron cargar terremotos USGS");
    }
  }

  async function fetchLatestEarthquakes() {
    const url = new URL(USGS_ENDPOINT);
    url.searchParams.set("format", "geojson");
    url.searchParams.set("eventtype", "earthquake");
    url.searchParams.set("minmagnitude", "7");
    url.searchParams.set("starttime", "1900-01-01");
    url.searchParams.set("orderby", "time");
    url.searchParams.set("limit", "20000");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`USGS respondió ${response.status}.`);
    }

    return response.json();
  }

  function normalizeFeature(feature) {
    const properties = feature?.properties || {};
    const magnitude = Number(properties.mag);
    const time = Number(properties.time);
    const coordinates = feature?.geometry?.coordinates || [];

    if (!Number.isFinite(magnitude) || !Number.isFinite(time)) {
      return null;
    }

    const date = new Date(time);
    return {
      id: feature.id || `${time}-${magnitude}`,
      dateIso: date.toISOString().slice(0, 10),
      timeIso: date.toISOString(),
      labelDate: date.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }),
      magnitude,
      longitude: Number(coordinates[0]),
      latitude: Number(coordinates[1]),
      depth: Number(coordinates[2]),
      place: properties.place || "Ubicación no informada",
    };
  }

  function renderOptions(events) {
    select.innerHTML = "";
    select.appendChild(new Option("Elegir fecha por terremoto M7+ desde 1900 (USGS)", ""));

    events.forEach((event, index) => {
      const option = new Option(
        `${event.labelDate} · M ${event.magnitude.toFixed(1)} · ${event.place}`,
        event.id || `earthquake-${index}`,
      );
      option.dataset.date = event.dateIso;
      option.dataset.timeIso = event.timeIso;
      option.dataset.magnitude = event.magnitude;
      option.dataset.place = event.place;
      option.dataset.longitude = Number.isFinite(event.longitude) ? event.longitude : "";
      option.dataset.latitude = Number.isFinite(event.latitude) ? event.latitude : "";
      option.dataset.depth = Number.isFinite(event.depth) ? event.depth : "";
      select.appendChild(option);
    });

    const matchingOption = Array.from(select.options).find((option) => option.dataset.date === dateInput.value);
    select.value = matchingOption ? matchingOption.value : "";
  }

  function setPlaceholder(text) {
    select.innerHTML = "";
    select.appendChild(new Option(text, ""));
  }

  function createCatalogExportButton() {
    if (!exportCsvButton?.parentElement) {
      return null;
    }

    const existing = document.getElementById("exportEarthquakeCatalogCsvButton");
    if (existing) {
      return existing;
    }

    const button = document.createElement("button");
    button.id = "exportEarthquakeCatalogCsvButton";
    button.className = "secondary-button";
    button.type = "button";
    button.textContent = "Exportar CSV M7+ histórico";
    exportCsvButton.insertAdjacentElement("afterend", button);
    return button;
  }

  async function exportCatalogCsv() {
    const events = getListedEarthquakes();

    if (!events.length) {
      setExportStatus("Primero deben cargarse los terremotos M7+ de USGS.", 0);
      return;
    }

    catalogExportButton.disabled = true;
    try {
      setExportStatus("Preparando ciudades y límites de placas...", 0.03);
      const cities = await loadCitiesFromApp();
      const plateDistances = await getPlateDistances(cities);
      const weatherDates = [...new Set(events.map((event) => event.date).filter((date) => date >= WEATHER_START_DATE))].sort();
      const weatherByCity = weatherDates.length ? await fetchWeatherByCity(cities, weatherDates) : new Map();

      setExportStatus("Generando CSV histórico M7+...", 0.96);
      const csv = buildCatalogCsv(events, cities, weatherByCity, plateDistances);
      downloadCsv(csv, `mapa-mundo-terremotos-m7-desde-1900-${new Date().toISOString().slice(0, 10)}.csv`);
      setExportStatus(`CSV histórico generado: ${events.length} terremotos por ${cities.length} ciudades.`, 1);
    } catch (error) {
      console.error(error);
      setExportStatus(`No se pudo generar el CSV histórico: ${error.message}`, 0);
    } finally {
      catalogExportButton.disabled = false;
    }
  }

  function getListedEarthquakes() {
    return Array.from(select.options)
      .filter((option) => option.dataset.date)
      .map((option, index) => ({
        id: option.value || `m7-${index}`,
        date: option.dataset.date,
        timeIso: option.dataset.timeIso || `${option.dataset.date}T00:00:00.000Z`,
        magnitude: numeric(option.dataset.magnitude),
        place: option.dataset.place || option.textContent,
        latitude: numeric(option.dataset.latitude),
        longitude: numeric(option.dataset.longitude),
        depth: numeric(option.dataset.depth),
      }));
  }

  async function loadCitiesFromApp() {
    const response = await fetch("assets/app.js", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("No se pudo leer la lista de ciudades de la app.");
    }

    const source = await response.text();
    const match = source.match(/const CITIES = (\[[\s\S]*?\n\]);/);
    if (!match) {
      throw new Error("No se pudo identificar la lista de ciudades de la app.");
    }

    return Function(`"use strict"; return ${match[1]};`)();
  }

  async function getPlateDistances(cities) {
    try {
      const response = await fetch(PLATE_BOUNDARIES_URL);
      if (!response.ok) {
        throw new Error(`placas ${response.status}`);
      }

      const payload = await response.json();
      const segments = plateSegments(payload);
      const distances = new Map();
      cities.forEach((city) => distances.set(cityKey(city), nearestPlateDistanceKm(city, segments)));
      return distances;
    } catch (error) {
      console.error(error);
      return new Map();
    }
  }

  function plateSegments(payload) {
    const segments = [];

    (payload.features || []).forEach((feature) => {
      const geometry = feature.geometry || {};
      if (geometry.type === "LineString") {
        pushLineSegments(segments, geometry.coordinates);
      }
      if (geometry.type === "MultiLineString") {
        geometry.coordinates.forEach((line) => pushLineSegments(segments, line));
      }
    });

    return segments;
  }

  function pushLineSegments(segments, coordinates) {
    for (let index = 1; index < coordinates.length; index += 1) {
      const start = coordinates[index - 1];
      const end = coordinates[index];
      if (isCoordinate(start) && isCoordinate(end)) {
        segments.push({ start, end });
      }
    }
  }

  function isCoordinate(value) {
    return Array.isArray(value) && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
  }

  function nearestPlateDistanceKm(city, segments) {
    let nearest = Infinity;
    segments.forEach((segment) => {
      const distance = distanceToSegmentKm(city, segment.start, segment.end);
      if (distance < nearest) {
        nearest = distance;
      }
    });
    return Number.isFinite(nearest) ? nearest : null;
  }

  function distanceToSegmentKm(city, start, end) {
    const lat0 = city.lat;
    const cosLat = Math.cos((lat0 * Math.PI) / 180);
    const ax = wrappedLonDelta(Number(start[0]), city.lon) * 111.32 * cosLat;
    const ay = (Number(start[1]) - city.lat) * 110.57;
    const bx = wrappedLonDelta(Number(end[0]), city.lon) * 111.32 * cosLat;
    const by = (Number(end[1]) - city.lat) * 110.57;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
    const px = ax + t * dx;
    const py = ay + t * dy;
    return Math.sqrt(px * px + py * py);
  }

  function wrappedLonDelta(lon, origin) {
    let delta = lon - origin;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  }

  async function fetchWeatherByCity(cities, weatherDates) {
    const byCity = new Map();
    const startDate = weatherDates[0];
    const endDate = weatherDates[weatherDates.length - 1];
    let completed = 0;

    const tasks = cities.map((city) => async () => {
      try {
        byCity.set(cityKey(city), await fetchCityWeatherRange(city, startDate, endDate));
      } catch (error) {
        console.error(error);
        byCity.set(cityKey(city), {});
      }
      completed += 1;
      setExportStatus(`Cargando NASA POWER histórico: ${completed}/${cities.length} ciudades...`, 0.1 + (completed / cities.length) * 0.82);
    });

    await runLimited(tasks, 3);
    return byCity;
  }

  async function fetchCityWeatherRange(city, startDate, endDate) {
    const url = new URL(NASA_POWER_ENDPOINT);
    url.searchParams.set("parameters", WEATHER_PARAMETERS.join(","));
    url.searchParams.set("community", "AG");
    url.searchParams.set("longitude", city.lon);
    url.searchParams.set("latitude", city.lat);
    url.searchParams.set("start", compactDate(startDate));
    url.searchParams.set("end", compactDate(endDate));
    url.searchParams.set("format", "JSON");
    url.searchParams.set("time-standard", "UTC");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NASA POWER respondió ${response.status} para ${city.name}.`);
    }

    const payload = await response.json();
    return payload?.properties?.parameter || {};
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

  function buildCatalogCsv(events, cities, weatherByCity, plateDistances) {
    const header = [
      "terremoto_id",
      "terremoto_fecha",
      "terremoto_utc",
      "terremoto_magnitud",
      "terremoto_lugar",
      "terremoto_latitud",
      "terremoto_longitud",
      "terremoto_profundidad_km",
      "ciudad",
      "pais",
      "ciudad_latitud",
      "ciudad_longitud",
      "temperatura_promedio_c",
      "humedad_promedio_pct",
      "presion_atmosferica_kpa",
      "fase_lunar",
      "ciudad_cerca_limite_placa_300km",
      "ciudad_distancia_limite_placa_km",
      "fuente_meteorologica",
      "fuente_sismos",
      "fuente_placas",
      "nota",
    ];
    const rows = [header];

    events.forEach((event) => {
      const ymd = compactDate(event.date);
      const moon = moonPhaseForDate(event.date);

      cities.forEach((city) => {
        const cityWeather = weatherByCity.get(cityKey(city)) || {};
        const weatherAvailable = event.date >= WEATHER_START_DATE;
        const plateDistance = plateDistances.get(cityKey(city));
        const nearPlate = Number.isFinite(plateDistance) && plateDistance <= NEAR_PLATE_LIMIT_KM;
        const note = weatherAvailable ? "" : `Sin datos meteorológicos NASA POWER antes de ${WEATHER_START_DATE}`;

        rows.push([
          event.id,
          event.date,
          event.timeIso,
          valueOrBlank(event.magnitude),
          event.place,
          valueOrBlank(event.latitude),
          valueOrBlank(event.longitude),
          valueOrBlank(event.depth),
          city.name,
          city.country,
          city.lat,
          city.lon,
          weatherAvailable ? normalizeWeatherValue(cityWeather.T2M?.[ymd]) : "",
          weatherAvailable ? normalizeWeatherValue(cityWeather.RH2M?.[ymd]) : "",
          weatherAvailable ? normalizeWeatherValue(cityWeather.PS?.[ymd]) : "",
          moon.label,
          nearPlate ? "si" : "no",
          Number.isFinite(plateDistance) ? plateDistance.toFixed(1) : "",
          weatherAvailable ? "NASA POWER Daily API" : "NASA POWER Daily API no disponible",
          "USGS Earthquake Catalog API",
          "PB2002 tectonic plate boundaries",
          note,
        ]);
      });
    });

    return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  }

  function moonPhaseForDate(date) {
    const selected = new Date(`${date}T12:00:00Z`).getTime();
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
    const synodicMonthMs = 29.530588853 * 24 * 60 * 60 * 1000;
    const age = ((selected - knownNewMoon) % synodicMonthMs + synodicMonthMs) % synodicMonthMs;
    const fraction = age / synodicMonthMs;

    if (fraction < 0.03 || fraction >= 0.97) return { label: "Luna nueva" };
    if (fraction < 0.22) return { label: "Creciente" };
    if (fraction < 0.28) return { label: "Cuarto creciente" };
    if (fraction < 0.47) return { label: "Gibosa creciente" };
    if (fraction < 0.53) return { label: "Luna llena" };
    if (fraction < 0.72) return { label: "Gibosa menguante" };
    if (fraction < 0.78) return { label: "Cuarto menguante" };
    return { label: "Menguante" };
  }

  function normalizeWeatherValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > -900 ? parsed : "";
  }

  function cityKey(city) {
    return `${city.name}|${city.country}`;
  }

  function compactDate(date) {
    return date.replaceAll("-", "");
  }

  function numeric(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : "";
  }

  function valueOrBlank(value) {
    return Number.isFinite(Number(value)) ? value : "";
  }

  function escapeCsv(value) {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
  }

  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function setExportStatus(message, value) {
    if (statusText) {
      statusText.textContent = message;
    }
    if (progress) {
      progress.value = value;
    }
  }
})();
