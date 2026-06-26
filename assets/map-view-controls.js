"use strict";

(() => {
  const root = document.getElementById("mapRoot");
  const zoomIn = document.getElementById("mapZoomIn");
  const zoomOut = document.getElementById("mapZoomOut");
  const displayScaleInput = document.getElementById("mapDisplayScale");

  if (!root || !zoomIn || !zoomOut || !displayScaleInput) {
    return;
  }

  const state = {
    scale: 1,
    x: 0,
    y: 0,
    displayScale: Number(displayScaleInput.value) || 1,
  };

  zoomIn.addEventListener("click", () => setZoom(state.scale * 1.25));
  zoomOut.addEventListener("click", () => setZoom(state.scale / 1.25));
  displayScaleInput.addEventListener("input", () => {
    state.displayScale = Number(displayScaleInput.value) || 1;
    applyConstantDisplayScale();
  });

  new MutationObserver(applyConstantDisplayScale).observe(root, {
    childList: true,
    subtree: true,
  });

  applyConstantDisplayScale();

  function setZoom(nextScale) {
    const clamped = Math.max(1, Math.min(8, nextScale));
    const svg = document.getElementById("worldMap");
    const box = svg?.viewBox?.baseVal;
    const width = box?.width || svg?.clientWidth || 1;
    const height = box?.height || svg?.clientHeight || 1;
    const cx = width / 2;
    const cy = height / 2;
    const ratio = clamped / state.scale;

    state.x = cx - ratio * (cx - state.x);
    state.y = cy - ratio * (cy - state.y);
    state.scale = clamped;

    root.setAttribute("transform", `translate(${state.x},${state.y}) scale(${state.scale})`);
    applyConstantDisplayScale();
  }

  function applyConstantDisplayScale() {
    const divisor = Math.max(1, state.scale);
    const factor = state.displayScale / divisor;

    document.querySelectorAll(".city-dot").forEach((node) => {
      node.setAttribute("r", 3.4 * factor);
      node.setAttribute("stroke-width", 1.15 * factor);
    });

    document.querySelectorAll(".city-label").forEach((node) => {
      node.setAttribute("font-size", 10 * factor);
      node.setAttribute("stroke-width", 4 * factor);
    });

    document.querySelectorAll(".earthquake-dot").forEach((node) => {
      const base = Number(node.dataset.baseRadius || 8);
      node.setAttribute("r", base * factor);
      node.setAttribute("stroke-width", 1.8 * factor);
    });

    document.querySelectorAll(".earthquake-label").forEach((node) => {
      node.setAttribute("font-size", 11 * factor);
      node.setAttribute("stroke-width", 4 * factor);
      node.setAttribute("dx", 10 * factor);
      node.setAttribute("dy", -8 * factor);
    });
  }
})();
