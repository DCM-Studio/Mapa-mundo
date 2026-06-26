"use strict";

(() => {
  const moonLabels = new Set([
    "Luna nueva",
    "Creciente",
    "Cuarto creciente",
    "Gibosa creciente",
    "Luna llena",
    "Gibosa menguante",
    "Cuarto menguante",
    "Menguante",
  ]);

  const toggles = [...document.querySelectorAll(".label-toggle")];
  const labelContainer = document.getElementById("cityLabels");

  if (!toggles.length || !labelContainer) {
    return;
  }

  let isApplying = false;

  toggles.forEach((toggle) => {
    toggle.addEventListener("change", applyLabelVisibility);
  });

  const observer = new MutationObserver(() => {
    if (isApplying) return;
    captureFullLabels();
    applyLabelVisibility();
  });

  observer.observe(labelContainer, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  captureFullLabels();
  applyLabelVisibility();

  function captureFullLabels() {
    document.querySelectorAll(".city-label").forEach((label) => {
      if (label.textContent.trim()) {
        label.dataset.fullLabel = label.textContent;
      }
    });
  }

  function applyLabelVisibility() {
    const visible = new Set(toggles.filter((toggle) => toggle.checked).map((toggle) => toggle.value));

    isApplying = true;
    document.querySelectorAll(".city-label").forEach((label) => {
      const fullLabel = label.dataset.fullLabel || label.textContent;
      const filtered = filterLabel(fullLabel, visible);
      label.textContent = filtered;
      label.style.display = filtered ? "" : "none";
    });
    requestAnimationFrame(() => {
      isApplying = false;
    });
  }

  function filterLabel(fullLabel, visible) {
    const parts = fullLabel.split(" · ");
    const city = parts.shift();
    const visibleParts = parts.filter((part) => visible.has(metricForPart(part)));

    if (!visibleParts.length) {
      return "";
    }

    return [city, ...visibleParts].join(" · ");
  }

  function metricForPart(part) {
    if (part.startsWith("Temp.")) return "temperature";
    if (part.startsWith("Pres.")) return "pressure";
    if (part.startsWith("Hum.")) return "humidity";
    if (moonLabels.has(part)) return "moon";
    return "moon";
  }
})();
