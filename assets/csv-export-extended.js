"use strict";

(() => {
  const NativeBlob = window.Blob;

  window.Blob = function MapaMundoBlob(parts = [], options = {}) {
    if (isCsvBlob(options) && Array.isArray(parts) && parts.length === 1 && typeof parts[0] === "string") {
      return new NativeBlob([buildExtendedCsv(parts[0])], options);
    }

    return new NativeBlob(parts, options);
  };

  window.Blob.prototype = NativeBlob.prototype;
  Object.setPrototypeOf(window.Blob, NativeBlob);

  function isCsvBlob(options) {
    return typeof options?.type === "string" && options.type.toLowerCase().includes("text/csv");
  }

  function buildExtendedCsv(originalCsv) {
    const parsed = parseCsv(originalCsv);

    if (parsed.length < 2 || !parsed[0].includes("temperatura_promedio_c")) {
      return originalCsv;
    }

    const sourceHeader = parsed[0];
    const sourceRows = parsed.slice(1);
    const sourceIndex = Object.fromEntries(sourceHeader.map((name, index) => [name, index]));
    const state = getExportState();

    const header = [
      "tipo_registro",
      "fecha",
      "ciudad",
      "pais",
      "latitud",
      "longitud",
      "temperatura_promedio_c",
      "humedad_promedio_pct",
      "presion_atmosferica_kpa",
      "fase_lunar",
      "terremoto_id",
      "magnitud",
      "profundidad_km",
      "lugar",
      "utc_iso",
      "significancia",
      "tipo_evento",
      "fuente",
      "capas_visibles",
      "filtros_aplicados",
    ];

    const cityRows = sourceRows.map((row) => [
      "ciudad_meteorologia",
      read(row, sourceIndex, "fecha"),
      read(row, sourceIndex, "ciudad"),
      read(row, sourceIndex, "pais"),
      read(row, sourceIndex, "latitud"),
      read(row, sourceIndex, "longitud"),
      read(row, sourceIndex, "temperatura_promedio_c"),
      read(row, sourceIndex, "humedad_promedio_pct"),
      read(row, sourceIndex, "presion_atmosferica_kpa"),
      read(row, sourceIndex, "fase_lunar"),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      read(row, sourceIndex, "fuente_meteorologica") || "NASA POWER Daily API",
      state.layers,
      state.filters,
    ]);

    const quakeRows = getEarthquakeRows(state);

    return [header, ...cityRows, ...quakeRows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  }

  function getEarthquakeRows(state) {
    const api = window.MapaMundoEarthquakes;
    const earthquakes = api?.getData ? api.getData() : [];

    if (!earthquakes.length) {
      return getEarthquakeRowsFromDom(state);
    }

    return earthquakes.map((quake, index) => [
      "terremoto_usgs",
      state.date,
      `S${index + 1}`,
      "",
      quake.latitude,
      quake.longitude,
      "",
      "",
      "",
      "",
      quake.id,
      quake.magnitude,
      Number.isFinite(quake.depth) ? quake.depth : "",
      quake.place,
      quake.timeIso,
      quake.significance,
      quake.type,
      "USGS Earthquake Catalog API",
      state.layers,
      state.filters,
    ]);
  }

  function getEarthquakeRowsFromDom(state) {
    return Array.from(document.querySelectorAll(".earthquake-item")).map((item, index) => {
      const text = item.textContent.replace(/\s+/g, " ").trim();
      const link = item.querySelector("a[href]");
      const match = text.match(
        /^S(\d+): M ([\d.]+) · (.*?) UTC ([^·]+) · Profundidad ([^·]+) · Epicentro ([-\d.]+),\s*([-\d.]+)/,
      );

      if (!match) {
        return [
          "terremoto_usgs",
          state.date,
          `S${index + 1}`,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          link ? eventIdFromUrl(link.href) : "",
          "",
          "",
          text,
          "",
          "",
          "earthquake",
          "USGS Earthquake Catalog API",
          state.layers,
          state.filters,
        ];
      }

      const [, marker, magnitude, place, utcTime, depth, latitude, longitude] = match;

      return [
        "terremoto_usgs",
        state.date,
        `S${marker}`,
        "",
        latitude,
        longitude,
        "",
        "",
        "",
        "",
        link ? eventIdFromUrl(link.href) : "",
        magnitude,
        parseDepth(depth),
        place,
        utcIso(state.date, utcTime),
        "",
        "earthquake",
        "USGS Earthquake Catalog API",
        state.layers,
        state.filters,
      ];
    });
  }

  function parseDepth(depth) {
    const value = Number(String(depth).replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(value) ? value : "";
  }

  function utcIso(date, time) {
    const match = String(time).match(/(\d{2}):(\d{2})/);
    return date && match ? `${date}T${match[1]}:${match[2]}:00Z` : "";
  }

  function eventIdFromUrl(url) {
    const parts = String(url).split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }

  function getExportState() {
    const date = document.getElementById("dateInput")?.value || "";
    const selectedMetrics = Array.from(document.querySelectorAll(".metric-toggle:checked")).map((input) => input.value);
    const visibleLabels = Array.from(document.querySelectorAll(".label-toggle:checked")).map((input) => input.value);
    const minMagnitude = document.getElementById("earthquakeMinMagnitude")?.value || "6.5";
    const layers = [
      document.getElementById("baseMapToggle")?.checked ? "mapa_base" : "",
      document.getElementById("tectonicPlatesToggle")?.checked ? "placas_tectonicas" : "",
      document.getElementById("earthquakesToggle")?.checked ? "terremotos_usgs" : "",
      document.getElementById("earthquakeLabelsToggle")?.checked ? "texto_terremotos" : "",
    ].filter(Boolean);
    const filters = [
      selectedMetrics.length ? `datos:${selectedMetrics.join("+")}` : "",
      visibleLabels.length ? `texto:${visibleLabels.join("+")}` : "texto:ninguno",
      document.getElementById("plateCityFilterToggle")?.checked ? "solo_ciudades_cerca_de_placas" : "",
      document.getElementById("earthquakesToggle")?.checked ? `magnitud_minima:${minMagnitude}` : "",
    ].filter(Boolean);

    return {
      date,
      layers: layers.join("|"),
      filters: filters.join("|"),
    };
  }

  function read(row, index, key) {
    const position = index[key];
    return Number.isInteger(position) ? row[position] || "" : "";
  }

  function parseCsv(csv) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < csv.length; index += 1) {
      const char = csv[index];
      const next = csv[index + 1];

      if (quoted) {
        if (char === "\"" && next === "\"") {
          value += "\"";
          index += 1;
        } else if (char === "\"") {
          quoted = false;
        } else {
          value += char;
        }
      } else if (char === "\"") {
        quoted = true;
      } else if (char === ",") {
        row.push(value);
        value = "";
      } else if (char === "\n") {
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      } else if (char !== "\r") {
        value += char;
      }
    }

    if (value || row.length) {
      row.push(value);
      rows.push(row);
    }

    return rows;
  }

  function escapeCsv(value) {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
  }
})();
