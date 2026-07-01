"use strict";

(() => {
  const baseMapToggle = document.getElementById("baseMapToggle");
  const plateCityFilterToggle = document.getElementById("plateCityFilterToggle");
  const tectonicPlatesToggle = document.getElementById("tectonicPlatesToggle");
  const root = document.getElementById("mapRoot");

  if (!root || !baseMapToggle || !plateCityFilterToggle) {
    return;
  }

  const PLATE_DISTANCE_LIMIT = 22;
  let scheduled = 0;

  baseMapToggle.addEventListener("change", applyBaseMapVisibility);
  plateCityFilterToggle.addEventListener("change", () => {
    if (plateCityFilterToggle.checked) {
      ensurePlateLayer();
    }
    scheduleRefresh();
  });

  new MutationObserver(scheduleRefresh).observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["d", "cx", "cy", "x", "y", "display", "transform"],
  });

  applyBaseMapVisibility();
  scheduleRefresh();

  function applyBaseMapVisibility() {
    const visible = baseMapToggle.checked;
    const background = document.getElementById("mapBackground");
    const countries = document.getElementById("countries");

    if (background) {
      background.style.display = visible ? "" : "none";
    }

    if (countries) {
      countries.style.display = visible ? "" : "none";
    }
  }

  function ensurePlateLayer() {
    if (!tectonicPlatesToggle || tectonicPlatesToggle.checked) {
      return;
    }

    tectonicPlatesToggle.checked = true;
    tectonicPlatesToggle.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function scheduleRefresh() {
    window.clearTimeout(scheduled);
    scheduled = window.setTimeout(() => {
      normalizeMetricAreaColors();
      applyPlateCityFilter();
    }, 120);
  }

  function normalizeMetricAreaColors() {
    const container = document.getElementById("metricAreas");

    if (!container) {
      return;
    }

    const groups = new Map();
    container.querySelectorAll("g[data-area-color-group='1']").forEach((group) => {
      groups.set(group.dataset.areaColorKey, group);
    });

    container.querySelectorAll(".metric-area").forEach((area) => {
      const key = getAreaColorKey(area);
      let group = groups.get(key);

      if (!group) {
        group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.dataset.areaColorGroup = "1";
        group.dataset.areaColorKey = key;
        group.style.mixBlendMode = "multiply";
        group.style.opacity = area.classList.contains("moon") ? "0.36" : "0.38";
        container.appendChild(group);
        groups.set(key, group);
      }

      group.appendChild(area);

      if (Number(area.getAttribute("opacity")) > 0) {
        area.setAttribute("opacity", "1");
      }
      area.style.mixBlendMode = "normal";
    });
  }

  function getAreaColorKey(area) {
    const metricClass = Array.from(area.classList).find((className) => className !== "metric-area") || "metric";
    const color = window.d3?.color(area.getAttribute("fill"));

    if (!color) {
      return `${metricClass}:${area.getAttribute("fill") || "none"}`;
    }

    const red = Math.round(color.r / 32);
    const green = Math.round(color.g / 32);
    const blue = Math.round(color.b / 32);

    return `${metricClass}:${red}-${green}-${blue}`;
  }

  function applyPlateCityFilter() {
    const nodes = document.querySelectorAll(".metric-area, .city-dot, .city-label");

    if (!plateCityFilterToggle.checked) {
      nodes.forEach(showIfFilteredByPlate);
      return;
    }

    const paths = Array.from(document.querySelectorAll(".tectonic-plate-boundary")).filter(
      (path) => path.getAttribute("d"),
    );

    if (!paths.length) {
      ensurePlateLayer();
      window.setTimeout(scheduleRefresh, 500);
      return;
    }

    const samples = buildPlateSamples(paths);
    nodes.forEach((node) => {
      const point = getNodePoint(node);
      const isNearPlate = point && isNearAnySample(point, samples, PLATE_DISTANCE_LIMIT);

      if (isNearPlate) {
        showIfFilteredByPlate(node);
      } else {
        hideByPlateFilter(node);
      }
    });
  }

  function buildPlateSamples(paths) {
    const samples = [];

    paths.forEach((path) => {
      let length = 0;
      try {
        length = path.getTotalLength();
      } catch (error) {
        length = 0;
      }

      if (!length) {
        return;
      }

      const step = Math.max(4, Math.min(12, length / 120));
      for (let distance = 0; distance <= length; distance += step) {
        const point = path.getPointAtLength(distance);
        samples.push({ x: point.x, y: point.y });
      }
    });

    return samples;
  }

  function getNodePoint(node) {
    const tag = node.tagName.toLowerCase();

    if (tag === "circle") {
      return {
        x: Number(node.getAttribute("cx")),
        y: Number(node.getAttribute("cy")),
      };
    }

    if (tag === "text") {
      return {
        x: Number(node.getAttribute("x")),
        y: Number(node.getAttribute("y")),
      };
    }

    return null;
  }

  function isNearAnySample(point, samples, limit) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return false;
    }

    const limitSquared = limit * limit;
    return samples.some((sample) => {
      const dx = sample.x - point.x;
      const dy = sample.y - point.y;
      return dx * dx + dy * dy <= limitSquared;
    });
  }

  function hideByPlateFilter(node) {
    node.dataset.plateFilterHidden = "1";
    node.style.display = "none";
  }

  function showIfFilteredByPlate(node) {
    if (node.dataset.plateFilterHidden === "1") {
      node.style.display = "";
      delete node.dataset.plateFilterHidden;
    }
  }
})();
