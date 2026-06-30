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
  const player = {
    frames: [],
    index: -1,
    timer: 0,
    playing: false,
    preparing: false,
    ready: false,
    activeFrame: null,
    selectedMetrics: [],
    cache: new Map(),
    abort: null,
  };
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
    createTimelineOverlay();
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
      <p class="hint">La secuencia carga todas las ciudades disponibles según el filtro de país y los datos seleccionados. Primero prepara los frames para que el mapa no quede en blanco entre fechas.</p>
      <div class="sequence-actions"><button id="sequencePlayButton" class="primary-button" type="button">▶ Play</button><button id="sequencePauseButton" class="secondary-button" type="button" disabled>Pausa</button><button id="sequenceStopButton" class="secondary-button" type="button" disabled>Detener</button></div>
      <p id="sequenceStatus" class="hint">Configura el rango y presiona Play.</p>`;

    Object.assign(controls, {
      mode: $("#sequenceMode", section),
      start: $("#sequenceStartDate", section),
      end: $("#sequenceEndDate", section),
      minMag: $("#sequenceMinMagnitude", section),
      speed: $("#sequenceSpeed", section),
      before: $("#sequenceDaysBefore", section),
      after: $("#sequenceDaysAfter", section),
      play: $("#sequencePlayButton", section),
      pause: $("#sequencePauseButton", section),
      stop: $("#sequenceStopButton", section),
      sequenceStatus: $("#sequenceStatus", section),
    });

    $$("input, select", section).forEach((input) => input.addEventListener("change", persistSequenceSettings));
    controls.play.addEventListener("click", () => void handlePlay());
    controls.pause.addEventListener("click", pauseSequence);
    controls.stop.addEventListener("click", () => stopSequence(true));
    return section;
  }

  function createTimelineOverlay() {
    const mapFrame = $("#mapFrame");
    if (!mapFrame || $("#sequenceTimelineOverlay")) return;

    const overlay = document.createElement("section");
    overlay.id = "sequenceTimelineOverlay";
    overlay.className = "sequence-timeline-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="sequence-timeline-head">
        <strong>Secuencia</strong>
        <span id="sequenceTimelineLabel">Sin frames cargados</span>
      </div>
      <input id="sequenceTimeline" type="range" min="0" max="0" step="1" value="0" disabled />`;
    mapFrame.prepend(overlay);

    controls.timelineOverlay = overlay;
    controls.timeline = $("#sequenceTimeline", overlay);
    controls.timelineLabel = $("#sequenceTimelineLabel", overlay);
    controls.timeline.addEventListener("input", () => void jumpToFrame(Number(controls.timeline.value), true));
  }

  async function handlePlay() {
    if (player.preparing || player.playing) return;
    if (player.ready && player.frames.length) {
      player.playing = true;
      setSequenceBusy(true);
      setSequenceStatus("Secuencia reanudada.");
      player.timer = window.setTimeout(() => void playNextFrame(), clampInt(controls.speed.value, 600, 10000, 2200));
      return;
    }
    await startSequence();
  }

  async function startSequence() {
    persistSequenceSettings();
    stopSequence(false);

    player.selectedMetrics = getSelectedMetrics();
    if (!player.selectedMetrics.length) {
      setSequenceStatus("Selecciona al menos clima o luna antes de iniciar la secuencia.");
      return;
    }
    if (!validRange(controls.start.value, controls.end.value)) {
      setSequenceStatus("Revisa el rango de fechas: inicio debe ser menor o igual al final.");
      return;
    }

    try {
      player.preparing = true;
      player.abort = new AbortController();
      setSequenceBusy(true);
      setSequenceStatus("Preparando secuencia...");
      player.frames = controls.mode.value === "earthquakes" ? await buildEarthquakeFrames() : buildClimateFrames();
      if (hasWeatherMetric(player.selectedMetrics)) player.frames = player.frames.filter((frame) => frame.date >= WEATHER_START);
      if (!player.frames.length) {
        setSequenceStatus(`No hay frames reproducibles. Si seleccionaste clima, NASA POWER parte en ${WEATHER_START}.`);
        stopSequence(false);
        return;
      }

      setupTimeline();
      await preloadFrames(player.frames);
      player.preparing = false;
      player.ready = true;
      player.playing = true;
      player.index = -1;
      setSequenceBusy(true);
      await playNextFrame();
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(error);
        setSequenceStatus(`No se pudo iniciar la secuencia: ${error.message}`);
      }
      stopSequence(false);
    }
  }

  async function preloadFrames(frames) {
    controls.timeline.disabled = true;
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index];
      if (player.abort?.signal.aborted) throw new DOMException("Secuencia detenida", "AbortError");
      setSequenceStatus(`Preparando frame ${index + 1}/${frames.length}: ${frame.date}...`);
      await prepareFrame(frame, index + 1, frames.length);
      updateTimeline(index, frame);
    }
    controls.timeline.disabled = false;
  }

  async function prepareFrame(frame, current = 0, total = 0) {
    const key = frameKey(frame);
    if (player.cache.has(key)) return player.cache.get(key);

    const cities = citiesForFrame(frame);
    const moon = getMoonPhase(frame.date);
    const rows = hasWeatherMetric(player.selectedMetrics)
      ? await fetchWeatherForCities(cities, frame.date, player.abort?.signal)
      : cities.map((city) => ({ city, values: { T2M: null, RH2M: null, PS: null }, error: null }));
    const preparedRows = rows.map((row) => ({ ...row, moon }));
    player.cache.set(key, preparedRows);

    if (total) {
      setStatus(`Frame ${current}/${total} preparado: ${preparedRows.length} ciudades.`, current / total);
    }
    return preparedRows;
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
    await renderSequenceFrame(player.index, false);
    player.timer = window.setTimeout(() => void playNextFrame(), clampInt(controls.speed.value, 600, 10000, 2200));
  }

  async function jumpToFrame(index, manual) {
    if (!player.frames.length || player.preparing) return;
    pauseSequence(false);
    player.index = clampInt(index, 0, player.frames.length - 1, 0);
    await renderSequenceFrame(player.index, manual);
    setSequenceBusy(false);
  }

  async function renderSequenceFrame(index, manual) {
    const frame = player.frames[index];
    if (!frame) return;
    player.activeFrame = frame;
    const rows = await prepareFrame(frame);
    renderPreparedRows(frame, rows);
    updateTimeline(index, frame);
    setSequenceStatus(`${manual ? "Frame manual" : "Frame"} ${index + 1}/${player.frames.length}: ${frameLabel(frame)}`);
  }

  function renderPreparedRows(frame, rows) {
    ensureAppRenderApi();
    const dateInput = $("#dateInput");
    if (dateInput) {
      dateInput.value = frame.date;
      dateInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (frame.mode === "earthquake") {
      ensureEarthquakeLayer(frame);
    }

    state.selectedDate = frame.date;
    state.selectedMetrics = player.selectedMetrics.slice();
    state.weatherRows = rows.map((row) => ({ ...row, moon: getMoonPhase(frame.date) }));
    state.currentRanges = {};
    computeRanges();
    redrawDataLayers();
    updateLegend();
    updateTitle();
    setStatus(`Mostrando ${state.weatherRows.length} ciudades para ${frame.date}.`, 1);
  }

  function ensureEarthquakeLayer(frame) {
    const quakeToggle = $("#earthquakesToggle");
    const quakeLabels = $("#earthquakeLabelsToggle");
    const minInput = $("#earthquakeMinMagnitude");
    if (quakeToggle && !quakeToggle.checked) { quakeToggle.checked = true; quakeToggle.dispatchEvent(new Event("change", { bubbles: true })); }
    if (quakeLabels && !quakeLabels.checked) { quakeLabels.checked = true; quakeLabels.dispatchEvent(new Event("change", { bubbles: true })); }
    if (minInput) { minInput.value = controls.minMag.value; minInput.dispatchEvent(new Event("change", { bubbles: true })); }
    window.MapaMundoEarthquakes?.setCountryFilter?.(settings.earthquakeCountry || "");
  }

  function pauseSequence(updateText = true) {
    player.playing = false;
    clearTimeout(player.timer);
    setSequenceBusy(false);
    if (updateText) setSequenceStatus("Secuencia en pausa. Puedes mover la barra de tiempo manualmente.");
  }

  function stopSequence(updateUi) {
    player.playing = false;
    player.preparing = false;
    player.ready = false;
    player.frames = [];
    player.index = -1;
    player.activeFrame = null;
    player.cache.clear();
    player.abort?.abort();
    player.abort = null;
    clearTimeout(player.timer);
    if (controls.timelineOverlay) controls.timelineOverlay.hidden = true;
    if (updateUi) { setSequenceBusy(false); setSequenceStatus("Secuencia detenida."); }
  }

  function setupTimeline() {
    if (!controls.timelineOverlay || !controls.timeline) return;
    controls.timelineOverlay.hidden = false;
    controls.timeline.min = "0";
    controls.timeline.max = String(Math.max(0, player.frames.length - 1));
    controls.timeline.value = "0";
    controls.timeline.disabled = true;
    controls.timelineLabel.textContent = `${player.frames.length} frame${player.frames.length === 1 ? "" : "s"} en preparación`;
  }

  function updateTimeline(index, frame) {
    if (!controls.timeline || !controls.timelineLabel) return;
    controls.timeline.value = String(index);
    controls.timelineLabel.textContent = `${index + 1}/${player.frames.length} · ${frame.date}${frame.event ? ` · M ${frame.event.magnitude.toFixed(1)}` : ""}`;
  }

  function filterCities(cities) {
    let result = Array.isArray(cities) ? cities.slice() : [];
    if (settings.cityCountry) result = result.filter((city) => normalize(city.country) === normalize(settings.cityCountry));
    if (player.activeFrame?.event) result.push(epicenterCity(player.activeFrame.event));
    return dedupeCities(result);
  }

  function citiesForFrame(frame) {
    const sourceCities = originalGetCities ? originalGetCities() : window.MapaMundoStaticData?.getCities?.() || [];
    let result = Array.isArray(sourceCities) ? sourceCities.slice() : [];
    if (settings.cityCountry) result = result.filter((city) => normalize(city.country) === normalize(settings.cityCountry));
    if (frame?.event) result.push(epicenterCity(frame.event));
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
    [[controls.mode, seq.mode], [controls.start, seq.start], [controls.end, seq.end], [controls.minMag, seq.minMagnitude], [controls.speed, seq.speed], [controls.before, seq.daysBefore], [controls.after, seq.daysAfter]].forEach(([control, value]) => { if (control && value != null) control.value = value; });
  }

  function persistSequenceSettings() {
    settings.sequence = { mode: controls.mode?.value, start: controls.start?.value, end: controls.end?.value, minMagnitude: controls.minMag?.value, speed: controls.speed?.value, daysBefore: controls.before?.value, daysAfter: controls.after?.value };
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
    if (!frame.event) return `clima/luna para ${frame.date}`;
    const offset = frame.offset === 0 ? "día del terremoto" : frame.offset < 0 ? `${Math.abs(frame.offset)} día(s) antes` : `${frame.offset} día(s) después`;
    return `${frame.date} · ${offset} · M ${frame.event.magnitude.toFixed(1)} · ${frame.event.place}`;
  }

  function setSequenceBusy(busy) {
    if (controls.play) {
      controls.play.disabled = busy;
      controls.play.textContent = player.ready && !player.playing && !player.preparing ? "▶ Reanudar" : "▶ Play";
    }
    if (controls.pause) controls.pause.disabled = !player.playing;
    if (controls.stop) controls.stop.disabled = !(player.preparing || player.playing || player.frames.length);
    if (controls.timeline) controls.timeline.disabled = player.preparing || !player.ready;
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

  function ensureAppRenderApi() {
    const missing = [];
    if (typeof state === "undefined") missing.push("state");
    if (typeof computeRanges !== "function") missing.push("computeRanges");
    if (typeof redrawDataLayers !== "function") missing.push("redrawDataLayers");
    if (typeof updateLegend !== "function") missing.push("updateLegend");
    if (typeof updateTitle !== "function") missing.push("updateTitle");
    if (typeof getMoonPhase !== "function") missing.push("getMoonPhase");
    if (missing.length) throw new Error(`No se pudo acceder al render del mapa: ${missing.join(", ")}.`);
  }

  function frameKey(frame) { return `${frame.mode}|${frame.date}|${frame.event?.id || "climate"}|${player.selectedMetrics.join("+")}|${settings.cityCountry || "all"}`; }
  function loadSettings() { try { return JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch { return {}; } }
  function saveSettings() { localStorage.setItem(STORE, JSON.stringify(settings)); }
  function getSelectedMetrics() { return $$(".metric-toggle").filter((toggle) => toggle.checked).map((toggle) => toggle.value); }
  function hasWeatherMetric(metrics = getSelectedMetrics()) { return metrics.some((metric) => metric !== "moon"); }
  function validRange(start, end) { return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end; }
  function eachDate(start, end) { const dates = []; const cursor = new Date(`${start}T00:00:00Z`); const limit = new Date(`${end}T00:00:00Z`); while (cursor <= limit) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); } return dates; }
  function addDays(date, amount) { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10); }
  function dedupeCities(cities) { const seen = new Set(); return cities.filter((city) => { if (!city || !Number.isFinite(Number(city.lat)) || !Number.isFinite(Number(city.lon))) return false; const key = `${String(city.name || "").toLowerCase()}|${String(city.country || "").toLowerCase()}|${Number(city.lat).toFixed(3)}|${Number(city.lon).toFixed(3)}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
  function clamp(value, min, max, fallback) { return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback; }
  function clampInt(value, min, max, fallback) { return Math.round(clamp(Number(value), min, max, fallback)); }
  function matchesCountry(place, country) { if (!country) return true; const haystack = normalize(place); return countryTerms(country).some((term) => haystack.includes(term)); }
  function inferCountry(place) { return COUNTRY_LIST.find((country) => matchesCountry(place, country)) || ""; }
  function countryTerms(country) { const key = normalize(country); return [...new Set([key, ...(ALIASES[key] || []).map(normalize)])].filter(Boolean); }
  function normalize(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  const COUNTRY_LIST = ["Chile", "Argentina", "Brasil", "Peru", "Colombia", "Ecuador", "Mexico", "Estados Unidos", "Canada", "Japon", "Indonesia", "Filipinas", "China", "Taiwan", "Nueva Zelanda", "Rusia", "Turquia", "Grecia", "Iran", "India", "Nepal", "Pakistan", "Papua Nueva Guinea", "Islas Salomon", "Vanuatu", "Tonga", "Fiji"];
  const ALIASES = { brasil: ["brazil"], mexico: ["baja california", "oaxaca", "guerrero", "chiapas"], "estados unidos": ["united states", "usa", "alaska", "california", "hawaii", "aleutian", "puerto rico"], canada: ["british columbia", "yukon"], japon: ["japan", "honshu", "hokkaido", "kyushu", "ryukyu"], indonesia: ["sumatra", "java", "sulawesi", "banda sea", "molucca sea"], filipinas: ["philippines", "mindanao", "luzon"], china: ["xinjiang", "tibet", "sichuan", "yunnan"], "nueva zelanda": ["new zealand", "kermadec"], rusia: ["russia", "kamchatka", "kuril", "sakhalin"], turquia: ["turkey", "turkiye"], grecia: ["greece", "crete"], "papua nueva guinea": ["papua new guinea", "new britain", "bougainville"], "islas salomon": ["solomon islands"] };
})();
