"use strict";

(() => {
  const style = document.createElement("style");
  style.textContent = "[hidden]{display:none!important}";
  document.head.append(style);

  const keepMapBackgroundBehindLayers = () => {
    const svg = document.getElementById("worldMap");
    const background = svg?.querySelector("#mapBackground");
    if (svg && background && svg.firstChild !== background) {
      svg.insertBefore(background, svg.firstChild);
    }
  };

  keepMapBackgroundBehindLayers();
  window.addEventListener("resize", () => setTimeout(keepMapBackgroundBehindLayers, 220));

  const svg = document.getElementById("worldMap");
  if (svg) {
    new MutationObserver(keepMapBackgroundBehindLayers).observe(svg, {
      childList: true,
    });
  }
})();
