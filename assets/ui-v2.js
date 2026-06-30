"use strict";

(() => {
  const STORE = "mapa_mundo_v2_settings";
  const USGS_ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query";
  const WEATHER_START = "1981-01-01";
  const MAX_EVENTS = 200;
  const MAX_DAYS = 365;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const settings = loadSettings();
  const controls = {};
  const player = { frames: [], index: -1, timer: 0, playing: false, activeFrame: null };
  let originalGetCities = null;

  window.MapaMundoV2 = {
    get activeFrame() {
      return player.activeFrame;
    },
    stop: () => stopSequence(true),
  };

  boot();

  function boot() {
    hookCitySource();
    buildPanels();
    applySavedSettings();
  }

  function hookCitySource() {
    const api = window.MapaMundoStaticData;
    if (!api?.getCities || api.__v2FilterHookInstalled) return;
    originalGetCities = api.getCities.bind(api);
    api.getCities = () => filterCities(originalGetCities());
    api.__v2FilterHookInstalled = true;
  }

  function buildPanels() {
    const sidebar = $(".sidebar");
    const brand = $(".brand-row");
    if (!sidebar || !brand || $("#v2Tabs")) return;

    const sections = new Map($$("section.control-group", sidebar).map((section) => [$("h2", section)?.textContent?.trim(), section]));
    const filters = createFiltersSection();
    const sequence = createSequenceSection();
    const tabs = [
      ["visual", "Visualización", ["Fecha", "Datos a mostrar", "Texto en el mapa", "Capas geológicas", "Vista del mapa"]],
      ["filters", "Filtros", [filters, "Sismos USGS"]],
      ["sequence", "Secuencia ▶", [sequence]],
      ["colors", "Colores", ["Colores"]],
    ];

    const nav = document.createElement("nav");
    nav.id = "v2Tabs";
    nav.className = "tab-nav";
    nav.setAttribute("aria-label", "Configuración Mapa Mundo 2.0");
    const panels = document.createElement("div");
    panels.id = "v2Panels";
    panels.className = "tab-panels";

    tabs.forEach(([id, label, items], index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tab-button${index ? "" : " is-active"}`;
      button.dataset.tabTarget = id;
      button.textContent = label;
      button.addEventListener("click", () => activateTab(id));
      nav.append(button);

      const panel = document.createElement("section");
      panel.className = "tab-panel";
      panel.dataset.tabPanel = id;
      panel.hidden = index !== 0;
      items.forEach((item) => {
        const section = typeof item === "string" ? sections.get(item) : item;
        if (section) panel.append(section);
      });
      panels.append(panel);
    });

    brand.insertAdjacentElement("afterend", nav);
    nav.insertAdjacentElement("afterend", panels);
  }

  function activateTab(id) {
    $$(".tab-button").forEach((button) => button.classList.toggle("is-active", button.dataset.tabTarget === id));
    $$(".tab-panel").forEach((panel) => (panel.hidden = panel.dataset.tabPanel !== id));
  }

  function createFiltersSection() {
    const section = document.createElement("section");
    section.className = "control-group v2-control-group";
    section.innerHTML = `
      <h2>Filtros por país</h2>
      <label>País de ciudades<select id="cityCountryFilter"></select></label>
      <label>País/lugar de terremotos USGS<select id="earthquakeCountryFilter"></select></label>
      <p class="hint">“Todos los países” mantiene visible todo. El país de terremoto se filtra por el texto de ubicación informado por USGS; en eventos oceánicos puede no existir país exacto.</p>`;

    controls.cityCountry = $("#cityCountryFilter", section);
    controls.earthquakeCountry = $("#earthquakeCountryFilter", section);
    fillCountrySelect(controls.cityCountry, "Todos los países", false);
    fillCountrySelect(controls.earthquakeCountry, "Todos los países", true);

    controls.cityCountry.addEventListener("change", () => {
      settings.cityCountry = controls.cityCountry.value;
      saveSettings();
      setStatus("Filtro de ciudades actualizado. Presiona Aplicar ajustes para recargar datos.", 0);
    });
    controls.earthquakeCountry.addEventListener("change", () => {
      settings.earthquakeCountry = controls.earthquakeCountry.value;
      window.MapaMundoEarthquakes?.setCountryFilter?.(settings.earthquakeCountry);
      saveSettings();
    });
    return section;
  }

  function createSequenceSection() {
    const today = new Date().toISOString().slice(0, 10);
    const selectedDate = $("#dateInput")?.value || today;
    const section = document.createElement("section");
    section.className = "control-group v2-control-group sequence-panel";
    section.innerHTML = `
      <h2>Secuencia automática</h2>
      <label>Modo<select id="sequenceMode"><option value="earthquakes">Terremotos en orden cronológico</option><option value="climate">Clima/luna día por día</option></select></label>
      <div class="two-col"><label>Inicio<input id="sequenceStartDate" type="date" min="1900-01-01" value="${WEATHER_START}" /></label><label>Final<input id="sequenceEndDate" type="date" min="1900-01-01" value="${selectedDate}" max="${today}" /></label></div>
      <div class="two-col"><label>Magnitud mínima Mx<input id="sequenceMinMagnitude" type="number" min="0" max="10" step="0.1" value="6.5" /></label><label>Velocidad<select id="sequenceSpeed"><option value="1200">Rápida</option><option value="2200" selected>Normal</option><option value="4200">Lenta</option></select></label></div>
      <div class="two-col"><label>Días previos<input id="sequenceDaysBefore" type="number" min="0" max="30" step="1" value="0" /></label><label>Días posteriores<input id="sequenceDaysAfter" type="number" min="0" max="30" step="1" value="0" /></label></div>
      <label>Ciudades a mostrar<select id="sequenceCityScope"><option value="all">Todas las ciudades filtradas</option><option value="near">Sólo ciudades cercanas al epicentro</option></select></label>
      <label>Radio cercanas al epicentro (km)<input id="sequenceNearRadius" type="number" min="100" max="5000" step="100" value="1500" /></label>
      <div class="sequence-actions"><button id="sequencePlayButton" class="primary-button" type="button">▶ Play</button><button id="sequencePauseButton" class="secondary-button" type="button" disabled>Pausa</button><button id="sequenceStopButton" class="secondary-button" type="button" disabled>Detener</button></div>
      <p id="sequenceStatus" class="hint">Configura el rango y presiona Play.</p>`;

    Object.assign(controls, {
      mode: $("#sequenceMode", section), start: $("#sequenceStartDate", section), end: $("#sequenceEndDate", section), minMag: $("#sequenceMinMagnitude", section), speed: $("#sequenceSpeed", section), before: $("#sequenceDaysBefore", section), after: $("#sequenceDaysAfter", section), cityScope: $("#sequenceCityScope", section), radius: $("#sequenceNearRadius", section), play: $("#sequencePlayButton", section), pause: $("#sequencePauseButton", section), stop: $("#sequenceStopButton", section), sequenceStatus: $("#sequenceStatus", section),
    });

    $$("input, select", section).forEach((input) => input.addEventListener("change", persistSequenceSettings));
    controls.play.addEventListener("click", () => void startSequence());
    controls.pause.addEventListener("click", pauseSequence);
    controls.stop.addEventListener("click", () => stopSequence(true));
    return section;
  }

  async function startSequence() {
    if (player.playing) return;
    persistSequenceSettings();
    stopSequence(false);

    if (!getSelectedMetrics().length) {
      setSequenceStatus("Selecciona al menos clima o luna antes de iniciar la secuencia.");
      return;
    }
    if (!validRange(controls.start.value, controls.end.value)) {
      setSequenceStatus("Revisa el rango de fechas: inicio debe ser menor o igual al final.");
      return;
    }

    try {
      setSequenceBusy(true);
      setSequenceStatus("Preparando secuencia...");
      player.frames = controls.mode.value === "earthquakes" ? await buildEarthquakeFrames() : buildClimateFrames();
      if (hasWeatherMetric()) player.frames = player.frames.filter((frame) => frame.date >= WEATHER_START);
      if (!player.frames.length) {
        setSequenceStatus(`No hay frames reproducibles. Si seleccionaste clima, NASA POWER parte en ${WEATHER_START}.`);
        setSequenceBusy(false);
        return;
      }
      player.playing = true;
      player.index = -1;
      await playNextFrame();
    } catch (error) {
      console.error(error);
      setSequenceStatus(`No se pudo iniciar la secuencia: ${error.message}`);
      setSequenceBusy(false);
    }
  }

  async function buildEarthquakeFrames() {
    const minMag = clamp(Number(controls.minMag.value), 0, 10, 6.5);
    const response = await fetchEarthquakeRange(controls.start.value, controls.end.value, minMag);
    const events = (response.features || [])
      .map(normalizeQuake)
      .filter(Boolean)
      .filter((event) => matchesCountry(event.place, settings.earthquakeCountry || ""))
      .sort((a, b) => a.timeMs - b.timeMs)
      .slice(0, MAX_EVENTS);
    const before = clampInt(controls.before.value, 0, 30, 0);
    const after = clampInt(controls.after.value, 0, 30, 0);
    const today = new Date().toISOString().slice(0, 10);
    return events.flatMap((event) => {
      const frames = [];
      for (let offset = -before; offset <= after; offset += 1) frames.push({ mode: "earthquake", date: addDays(event.dateIso, offset), event, offset });
      return frames;
    }).filter((frame) => frame.date <= today);
  }

  function buildClimateFrames() {
    return eachDate(controls.start.value, controls.end.value).slice(0, MAX_DAYS).map((date) => ({ mode: "climate", date, event: null, offset: 0 }));
  }

  async function fetchEarthquakeRange(start, end, minMag) {
    const endDate = new Date(`${end}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const url = new URL(USGS_ENDPOINT);
    url.searchParams.set("format", "geojson");
    url.searchParams.set("eventtype", "earthquake");
    url.searchParams.set("starttime", `${start}T00:00:00`);
    url.searchParams.set("endtime", endDate.toISOString().slice(0, 19));
    url.searchParams.set("minmagnitude", minMag.toFixed(1));
    url.searchParams.set("orderby", "time-asc");
    url.searchParams.set("limit", String(MAX_EVENTS));
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`USGS respondió ${res.status}.`);
    return res.json();
  }

  async function playNextFrame() {
    if (!player.playing) return;
    player.index += 1;
    if (player.index >= player.frames.length) {
      player.playing = false;
      player.activeFrame = null;
      setSequenceBusy(false);
      setSequenceStatus(`Secuencia finalizada: ${player.frames.length} frame${player.frames.length === 1 ? "" : "s"}.`);
      return;
    }
    const frame = player.frames[player.index];
    player.activeFrame = frame;
    await renderFrame(frame);
    player.timer = window.setTimeout(() => void playNextFrame(), clampInt(controls.speed.value, 600, 10000, 2200));
  }

  async function renderFrame(frame) {
    const dateInput = $("#dateInput");
    const apply = $("#applyButton");
    if (!dateInput || !apply) return;
    dateInput.value = frame.date;
    dateInput.dispatchEvent(new Event("change", { bubbles: true }));

    if (frame.mode === "earthquake") {
      const quakeToggle = $("#earthquakesToggle");
      const quakeLabels = $("#earthquakeLabelsToggle");
      const minInput = $("#earthquakeMinMagnitude");
      if (quakeToggle && !quakeToggle.checked) { quakeToggle.checked = true; quakeToggle.dispatchEvent(new Event("change", { bubbles: true })); }
      if (quakeLabels && !quakeLabels.checked) { quakeLabels.checked = true; quakeLabels.dispatchEvent(new Event("change", { bubbles: true })); }
      if (minInput) { minInput.value = controls.minMag.value; minInput.dispatchEvent(new Event("change", { bubbles: true })); }
      window.MapaMundoEarthquakes?.setCountryFilter?.(settings.earthquakeCountry || "");
    }

    setSequenceStatus(frameLabel(frame));
    apply.click();
    await waitUntil(() => !apply.disabled, 45000);
  }

  function pauseSequence() {
    player.playing = false;
    clearTimeout(player.timer);
    setSequenceBusy(false);
    setSequenceStatus("Secuencia en pausa. Play reinicia desde el comienzo.");
  }

  function stopSequence(updateUi) {
    player.playing = false;
    player.frames = [];
    player.index = -1;
    player.activeFrame = null;
    clearTimeout(player.timer);
    if (updateUi) { setSequenceBusy(false); setSequenceStatus("Secuencia detenida."); }
  }

  function filterCities(cities) {
    let result = Array.isArray(cities) ? cities.slice() : [];
    if (settings.cityCountry) result = result.filter((city) => normalize(city.country) === normalize(settings.cityCountry));
    if (player.activeFrame?.event) result.push(epicenterCity(player.activeFrame.event));
    if (player.activeFrame?.event && controls.cityScope?.value === "near") {
      const radius = clamp(Number(controls.radius?.value), 100, 5000, 1500);
      const event = player.activeFrame.event;
      result = result.filter((city) => city.source === "USGS Earthquake Catalog API" || distanceKm(city.lat, city.lon, event.latitude, event.longitude) <= radius);
    }
    return dedupeCities(result);
  }

  function epicenterCity(event) {
    return { name: `Epicentro secuencia M${event.magnitude.toFixed(1)}`, country: event.countryHint || "USGS", lat: event.latitude, lon: event.longitude, source: "USGS Earthquake Catalog API", earthquakeId: event.id, earthquakeDate: event.dateIso, earthquakeMagnitude: event.magnitude };
  }

  function applySavedSettings() {
    if (controls.cityCountry) controls.cityCountry.value = settings.cityCountry || "";
    if (controls.earthquakeCountry) controls.earthquakeCountry.value = settings.earthquakeCountry || "";
    window.MapaMundoEarthquakes?.setCountryFilter?.(settings.earthquakeCountry || "");
    const seq = settings.sequence || {};
    [[controls.mode, seq.mode], [controls.start, seq.start], [controls.end, seq.end], [controls.minMag, seq.minMagnitude], [controls.speed, seq.speed], [controls.before, seq.daysBefore], [controls.after, seq.daysAfter], [controls.cityScope, seq.cityScope], [controls.radius, seq.nearRadius]].forEach(([control, value]) => { if (control && value != null) control.value = value; });
  }

  function persistSequenceSettings() {
    settings.sequence = { mode: controls.mode?.value, start: controls.start?.value, end: controls.end?.value, minMagnitude: controls.minMag?.value, speed: controls.speed?.value, daysBefore: controls.before?.value, daysAfter: controls.after?.value, cityScope: controls.cityScope?.value, nearRadius: controls.radius?.value };
    saveSettings();
  }

  function fillCountrySelect(select, label, extras) {
    if (!select) return;
    const extraCountries = extras ? ["Papua Nueva Guinea", "Islas Salomon", "Vanuatu", "Tonga", "Fiji"] : [];
    const base = window.MapaMundoStaticData?.baseCities || [];
    const countries = [...new Set([...base.map((city) => city.country).filter(Boolean), ...extraCountries])].sort((a, b) => a.localeCompare(b, "es"));
    select.innerHTML = "";
    select.append(new Option(label, ""));
    countries.forEach((country) => select.append(new Option(country, country)));
  }

  function normalizeQuake(feature) {
    const props = feature?.properties || {};
    const coords = feature?.geometry?.coordinates || [];
    const magnitude = Number(props.mag);
    const timeMs = Number(props.time);
    const longitude = Number(coords[0]);
    const latitude = Number(coords[1]);
    const depth = Number(coords[2]);
    if (![magnitude, timeMs, longitude, latitude].every(Number.isFinite)) return null;
    const date = new Date(timeMs);
    const place = props.place || "Ubicación no informada";
    return { id: feature.id || `${timeMs}-${magnitude}`, dateIso: date.toISOString().slice(0, 10), timeIso: date.toISOString(), timeMs, magnitude, longitude, latitude, depth: Number.isFinite(depth) ? depth : null, place, countryHint: inferCountry(place) || "USGS", url: props.url || "" };
  }

  function frameLabel(frame) {
    const current = player.index + 1;
    const total = player.frames.length;
    if (!frame.event) return `Frame ${current}/${total}: clima/luna para ${frame.date}.`;
    const offset = frame.offset === 0 ? "día del terremoto" : frame.offset < 0 ? `${Math.abs(frame.offset)} día(s) antes` : `${frame.offset} día(s) después`;
    return `Frame ${current}/${total}: ${frame.date} · ${offset} · M ${frame.event.magnitude.toFixed(1)} · ${frame.event.place}`;
  }

  function setSequenceBusy(busy) {
    if (controls.play) controls.play.disabled = busy;
    if (controls.pause) controls.pause.disabled = !busy;
    if (controls.stop) controls.stop.disabled = !busy && !player.frames.length;
  }

  function setSequenceStatus(text) {
    if (controls.sequenceStatus) controls.sequenceStatus.textContent = text;
    setStatus(text, player.frames.length ? Math.max(0, player.index + 1) / player.frames.length : 0);
  }

  function setStatus(text, progress) {
    const status = $("#statusText");
    const bar = $("#loadProgress");
    if (status) status.textContent = text;
    if (bar && Number.isFinite(progress)) bar.value = progress;
  }

  function loadSettings() { try { return JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch { return {}; } }
  function saveSettings() { localStorage.setItem(STORE, JSON.stringify(settings)); }
  function getSelectedMetrics() { return $$(".metric-toggle").filter((toggle) => toggle.checked).map((toggle) => toggle.value); }
  function hasWeatherMetric() { return getSelectedMetrics().some((metric) => metric !== "moon"); }
  function validRange(start, end) { return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end; }
  function waitUntil(test, timeoutMs) { const start = Date.now(); return new Promise((resolve) => { const tick = () => (test() || Date.now() - start > timeoutMs ? resolve() : setTimeout(tick, 350)); tick(); }); }
  function eachDate(start, end) { const dates = []; const cursor = new Date(`${start}T00:00:00Z`); const limit = new Date(`${end}T00:00:00Z`); while (cursor <= limit) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); } return dates; }
  function addDays(date, amount) { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10); }
  function dedupeCities(cities) { const seen = new Set(); return cities.filter((city) => { if (!city || !Number.isFinite(Number(city.lat)) || !Number.isFinite(Number(city.lon))) return false; const key = `${String(city.name || "").toLowerCase()}|${String(city.country || "").toLowerCase()}|${Number(city.lat).toFixed(3)}|${Number(city.lon).toFixed(3)}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
  function distanceKm(lat1, lon1, lat2, lon2) { const r = 6371; const dLat = rad(Number(lat2) - Number(lat1)); const dLon = rad(Number(lon2) - Number(lon1)); const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2; return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
  function rad(value) { return (Number(value) * Math.PI) / 180; }
  function clamp(value, min, max, fallback) { return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback; }
  function clampInt(value, min, max, fallback) { return Math.round(clamp(Number(value), min, max, fallback)); }
  function matchesCountry(place, country) { if (!country) return true; const haystack = normalize(place); return countryTerms(country).some((term) => haystack.includes(term)); }
  function inferCountry(place) { return COUNTRY_LIST.find((country) => matchesCountry(place, country)) || ""; }
  function countryTerms(country) { const key = normalize(country); return [...new Set([key, ...(ALIASES[key] || []).map(normalize)])].filter(Boolean); }
  function normalize(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  const COUNTRY_LIST = ["Chile", "Argentina", "Brasil", "Peru", "Colombia", "Ecuador", "Mexico", "Estados Unidos", "Canada", "Japon", "Indonesia", "Filipinas", "China", "Taiwan", "Nueva Zelanda", "Rusia", "Turquia", "Grecia", "Iran", "India", "Nepal", "Pakistan", "Papua Nueva Guinea", "Islas Salomon", "Vanuatu", "Tonga", "Fiji"];
  const ALIASES = { brasil: ["brazil"], mexico: ["baja california", "oaxaca", "guerrero", "chiapas"], "estados unidos": ["united states", "usa", "alaska", "california", "hawaii", "aleutian", "puerto rico"], canada: ["british columbia", "yukon"], japon: ["japan", "honshu", "hokkaido", "kyushu", "ryukyu"], indonesia: ["sumatra", "java", "sulawesi", "banda sea", "molucca sea"], filipinas: ["philippines", "mindanao", "luzon"], china: ["xinjiang", "tibet", "sichuan", "yunnan"], "nueva zelanda": ["new zealand", "kermadec"], rusia: ["russia", "kamchatka", "kuril", "sakhalin"], turquia: ["turkey", "turkiye"], grecia: ["greece", "crete"], "papua nueva guinea": ["papua new guinea", "new britain", "bougainville"], "islas solomon": ["solomon islands"], "islas salomon": ["solomon islands"] };
})();
