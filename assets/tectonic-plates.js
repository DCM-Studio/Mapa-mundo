"use strict";

(() => {
  const PLATES_URL =
    "https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json";
  const toggle = document.getElementById("tectonicPlatesToggle");
  const svg = d3.select("#worldMap");
  const root = d3.select("#mapRoot");

  if (!toggle || svg.empty() || root.empty() || !window.d3) {
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    .tectonic-plate-boundary-shadow {
      fill: none;
      stroke: rgba(255, 255, 255, 0.92);
      stroke-width: 2.8;
      stroke-linecap: round;
      stroke-linejoin: round;
      pointer-events: none;
    }
    .tectonic-plate-boundary {
      fill: none;
      stroke: #6f1111;
      stroke-width: 1.35;
      stroke-dasharray: 5 4;
      stroke-linecap: round;
      stroke-linejoin: round;
      pointer-events: none;
    }
  `;
  document.head.append(style);

  const group = root.append("g").attr("id", "tectonicPlatesLayer").attr("display", "none");
  const shadowGroup = group.append("g").attr("aria-hidden", "true");
  const lineGroup = group.append("g").attr("aria-label", "Límites de placas tectónicas");

  let boundaries = null;
  let loading = false;

  toggle.addEventListener("change", () => {
    group.attr("display", toggle.checked ? null : "none");

    if (toggle.checked) {
      loadAndDraw();
    }
  });

  window.addEventListener("resize", () => {
    if (toggle.checked && boundaries) {
      setTimeout(drawBoundaries, 180);
    }
  });

  async function loadAndDraw() {
    if (boundaries) {
      drawBoundaries();
      return;
    }

    if (loading) {
      return;
    }

    loading = true;
    try {
      const response = await fetch(PLATES_URL);
      if (!response.ok) {
        throw new Error(`No se pudieron cargar las placas (${response.status}).`);
      }
      boundaries = await response.json();
      drawBoundaries();
    } catch (error) {
      console.error(error);
      toggle.checked = false;
      group.attr("display", "none");
      const status = document.getElementById("statusText");
      if (status) {
        status.textContent = "No se pudieron cargar las placas tectónicas.";
      }
    } finally {
      loading = false;
    }
  }

  function drawBoundaries() {
    const viewBox = svg.node().viewBox.baseVal;
    const width = viewBox.width || svg.node().clientWidth;
    const height = viewBox.height || svg.node().clientHeight;

    if (!width || !height || !boundaries) {
      return;
    }

    const projection = d3.geoNaturalEarth1().fitExtent(
      [
        [18, 18],
        [width - 18, height - 18],
      ],
      { type: "Sphere" },
    );
    const path = d3.geoPath(projection);
    const features = boundaries.features || [];

    shadowGroup
      .selectAll("path")
      .data(features)
      .join("path")
      .attr("class", "tectonic-plate-boundary-shadow")
      .attr("d", path);

    lineGroup
      .selectAll("path")
      .data(features)
      .join("path")
      .attr("class", "tectonic-plate-boundary")
      .attr("d", path);
  }
})();
