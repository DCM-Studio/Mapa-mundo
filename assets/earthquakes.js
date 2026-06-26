"use strict";

(() => {
  const USGS_ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query";

  const toggle = document.getElementById("earthquakesToggle");
  const labelToggle = document.getElementById("earthquakeLabelsToggle");
  const minMagnitudeInput = document.getElementById("earthquakeMinMagnitude");
  const lowColor = document.getElementById("earthquakeLowColor");
  const highColor = document.getElementById("earthquakeHighColor");
  const dateInput = document.getElementById("dateInput");
  const applyButton = document.getElementById("applyButton");
  const details = document.getElementById("earthquakeDetails");
  const summary = document.getElementById("earthquakeSummary");
  const list = document.getElementById("earthquakeList");
  const svg = d3.select("#worldMap");
  const root = d3.select("#mapRoot");

  if (!toggle || !labelToggle || !minMagnitudeInput || !dateInput || svg.empty() || root.empty() || !window.d3) {
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    .earthquake-dot {
      stroke: #fff;
      stroke-width: 1.8;
      pointer-events: none;
    }
    .earthquake-label {
      paint-order: stroke;
      stroke: rgba(255, 255, 255, 0.95);
      stroke-width: 4px;
      fill: #151515;
      font-size: 11px;
      font-weight: 900;
      pointer-events: none;
    }
  `;
  document.head.append(style);

  const group = root.append("g").attr("id", "earthquakesLayer").attr("display", "none");
  const dotGroup = group.append("g").attr("aria-label", "Epicentros de terremotos");
  const labelGroup = group.append("g").attr("aria-label", "Texto de terremotos");

  let currentDate = "";
  let currentMinMagnitude = getMinMagnitude();
  let earthquakes = [];
  let loading = false;

  toggle.addEventListener("change", () => {
    group.attr("display", toggle.checked ? null : "none");
    details.hidden = !toggle.checked;

    if (toggle.checked) {
      loadForSelectedDate();
    }
  });

  labelToggle.addEventListener("change", drawEarthquakes);
  lowColor.addEventListener("input", drawEarthquakes);
  highColor.addEventListener("input", drawEarthquakes);
  dateInput.addEventListener("change", () => {
    if (toggle.checked) loadForSelectedDate();
  });
  minMagnitudeInput.addEventListener("change", () => {
    if (toggle.checked) loadForSelectedDate(true);
  });
  applyButton?.addEventListener("click", () => {
    if (toggle.checked) setTimeout(loadForSelectedDate, 0);
  });
  window.addEventListener("resize", () => {
    if (toggle.checked) setTimeout(drawEarthquakes, 180);
  });

  async function loadForSelectedDate(forceReload = false) {
    const date = dateInput.value;
    const minMagnitude = getMinMagnitude();
    if (!date || loading) return;

    if (!forceReload && date === currentDate && minMagnitude === currentMinMagnitude && earthquakes.length) {
      drawEarthquakes();
      renderDetails();
      return;
    }

    currentDate = date;
    currentMinMagnitude = minMagnitude;
    loading = true;
    setSummary("Cargando terremotos USGS...");

    try {
      const payload = await fetchEarthquakes(date, minMagnitude);
      earthquakes = (payload.features || [])
        .map(normalizeFeature)
        .filter(Boolean)
        .sort((a, b) => b.magnitude - a.magnitude);
      drawEarthquakes();
      renderDetails();
    } catch (error) {
      console.error(error);
      earthquakes = [];
      drawEarthquakes();
      setSummary("No se pudieron cargar los terremotos desde USGS.");
    } finally {
      loading = false;
    }
  }

  async function fetchEarthquakes(date, minMagnitude) {
    const start = `${date}T00:00:00`;
    const endDate = new Date(`${date}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const end = endDate.toISOString().slice(0, 19);

    const url = new URL(USGS_ENDPOINT);
    url.searchParams.set("format", "geojson");
    url.searchParams.set("starttime", start);
    url.searchParams.set("endtime", end);
    url.searchParams.set("minmagnitude", minMagnitude.toFixed(1));
    url.searchParams.set("eventtype", "earthquake");
    url.searchParams.set("orderby", "magnitude");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`USGS respondió ${response.status}.`);
    }

    return response.json();
  }

  function normalizeFeature(feature) {
    const coordinates = feature?.geometry?.coordinates || [];
    const properties = feature?.properties || {};
    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    const depth = Number(coordinates[2]);
    const magnitude = Number(properties.mag);

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isFinite(magnitude)) {
      return null;
    }

    return {
      id: feature.id,
      longitude,
      latitude,
      depth: Number.isFinite(depth) ? depth : null,
      magnitude,
      place: properties.place || "Ubicación no informada",
      time: properties.time ? new Date(properties.time) : null,
      url: properties.url || "",
      type: properties.type || "earthquake",
      significance: properties.sig || "",
    };
  }

  function drawEarthquakes() {
    group.attr("display", toggle.checked ? null : "none");

    if (!toggle.checked) {
      return;
    }

    const viewBox = svg.node().viewBox.baseVal;
    const width = viewBox.width || svg.node().clientWidth;
    const height = viewBox.height || svg.node().clientHeight;

    if (!width || !height) {
      return;
    }

    const projection = d3.geoNaturalEarth1().fitExtent(
      [
        [18, 18],
        [width - 18, height - 18],
      ],
      { type: "Sphere" },
    );

    dotGroup
      .selectAll("circle")
      .data(earthquakes, (quake) => quake.id)
      .join("circle")
      .attr("class", "earthquake-dot")
      .attr("cx", (quake) => projection([quake.longitude, quake.latitude])[0])
      .attr("cy", (quake) => projection([quake.longitude, quake.latitude])[1])
      .attr("data-base-radius", (quake) => radiusForMagnitude(quake.magnitude))
      .attr("r", (quake) => radiusForMagnitude(quake.magnitude))
      .attr("fill", (quake) => colorForMagnitude(quake.magnitude))
      .attr("opacity", 0.92);

    labelGroup
      .selectAll("text")
      .data(labelToggle.checked ? earthquakes : [], (quake) => quake.id)
      .join("text")
      .attr("class", "earthquake-label")
      .attr("x", (quake) => projection([quake.longitude, quake.latitude])[0])
      .attr("y", (quake) => projection([quake.longitude, quake.latitude])[1])
      .attr("dx", 10)
      .attr("dy", -8)
      .text((quake, index) => `S${index + 1} · M ${quake.magnitude.toFixed(1)} · ${formatDepth(quake.depth)}`);

    window.dispatchEvent(new Event("resize"));
  }

  function renderDetails() {
    details.hidden = !toggle.checked;

    if (!earthquakes.length) {
      setSummary(`No hay terremotos M ${currentMinMagnitude.toFixed(1)}+ registrados por USGS para ${formatDate(currentDate)}.`);
      list.innerHTML = "";
      return;
    }

    setSummary(
      `${earthquakes.length} terremoto${earthquakes.length === 1 ? "" : "s"} M ${currentMinMagnitude.toFixed(1)}+ registrados por USGS para ${formatDate(currentDate)}.`,
    );
    list.className = "earthquake-list";
    list.innerHTML = earthquakes.map(renderEarthquakeItem).join("");
  }

  function renderEarthquakeItem(quake, index) {
    const time = quake.time
      ? quake.time.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
      : "hora no informada";
    const depth = formatDepth(quake.depth);
    const coords = `${quake.latitude.toFixed(3)}, ${quake.longitude.toFixed(3)}`;
    const link = quake.url ? ` · <a href="${quake.url}" target="_blank" rel="noopener">USGS</a>` : "";

    return `
      <div class="earthquake-item">
        <strong>S${index + 1}: M ${quake.magnitude.toFixed(1)} · ${quake.place}</strong>
        UTC ${time} · Profundidad ${depth} · Epicentro ${coords}${link}
      </div>
    `;
  }

  function setSummary(text) {
    details.hidden = !toggle.checked;
    summary.textContent = text;
  }

  function colorForMagnitude(magnitude) {
    return d3.interpolateRgb(lowColor.value, highColor.value)(
      Math.max(0, Math.min(1, (magnitude - currentMinMagnitude) / Math.max(1, 8 - currentMinMagnitude))),
    );
  }

  function radiusForMagnitude(magnitude) {
    return 6 + Math.max(0, magnitude - currentMinMagnitude) * 3.2;
  }

  function getMinMagnitude() {
    const value = Number(minMagnitudeInput.value);
    if (!Number.isFinite(value)) return 6.5;
    return Math.max(0, Math.min(10, value));
  }

  function formatDepth(depth) {
    return Number.isFinite(depth) ? `${depth.toFixed(1)} km` : "no informada";
  }

  function formatDate(date) {
    return new Date(`${date}T12:00:00Z`).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
})();
