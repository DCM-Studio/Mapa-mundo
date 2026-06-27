"use strict";

(() => {
  const areaLayer = document.getElementById("metricAreas");
  const dateInput = document.getElementById("dateInput");
  const moonColor = document.getElementById("moonColor");

  if (!areaLayer || !dateInput || !moonColor) {
    return;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  let scheduled = 0;

  new MutationObserver((mutations) => {
    const onlyMarkerChanges = mutations.every((mutation) => {
      const target = mutation.target;
      return target instanceof Element && target.closest(".moon-phase-marker");
    });

    if (!onlyMarkerChanges) {
      scheduleDraw();
    }
  }).observe(areaLayer, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["cx", "cy", "r", "fill", "opacity", "display", "style"],
  });

  dateInput.addEventListener("change", scheduleDraw);
  moonColor.addEventListener("input", scheduleDraw);

  scheduleDraw();

  function scheduleDraw() {
    window.clearTimeout(scheduled);
    scheduled = window.setTimeout(drawMoonPhases, 80);
  }

  function drawMoonPhases() {
    const phase = moonPhaseForDate(dateInput.value);
    const circles = Array.from(areaLayer.querySelectorAll("circle.metric-area.moon"));
    const markers = new Map(
      Array.from(areaLayer.querySelectorAll("g.moon-phase-marker")).map((marker) => [marker.dataset.moonKey, marker]),
    );

    circles.forEach((circle, index) => {
      const key = circle.dataset.moonKey || `moon-${index}`;
      circle.dataset.moonKey = key;
      circle.setAttribute("opacity", "0");

      let marker = markers.get(key);
      if (!marker) {
        marker = document.createElementNS(SVG_NS, "g");
        marker.classList.add("moon-phase-marker");
        marker.dataset.moonKey = key;
        marker.style.pointerEvents = "none";
        areaLayer.appendChild(marker);
      }

      marker.style.display = circle.style.display === "none" || circle.getAttribute("display") === "none" ? "none" : "";
      renderMarker(marker, Number(circle.getAttribute("cx")), Number(circle.getAttribute("cy")), Number(circle.getAttribute("r")), phase);
      markers.delete(key);
    });

    markers.forEach((marker) => marker.remove());
  }

  function renderMarker(marker, cx, cy, radius, phase) {
    const r = Number.isFinite(radius) && radius > 0 ? Math.max(7, Math.min(12, radius)) : 8;
    const light = moonColor.value || "#f5f0c9";
    const dark = "#17222b";
    const stroke = "#102b35";

    marker.setAttribute("transform", `translate(${cx},${cy})`);
    marker.setAttribute("aria-label", phase.label);
    marker.innerHTML = "";

    marker.appendChild(circle(0, 0, r + 1.6, "rgba(255,255,255,0.82)", "none", 0));
    marker.appendChild(circle(0, 0, r, dark, stroke, 1.05));

    if (phase.kind === "new") {
      marker.appendChild(circle(0, 0, r * 0.28, light, "none", 0));
      return;
    }

    if (phase.kind === "full") {
      marker.appendChild(circle(0, 0, r * 0.92, light, "none", 0));
      return;
    }

    marker.appendChild(path(phasePath(phase.kind, r), light));
  }

  function circle(cx, cy, r, fill, stroke, strokeWidth) {
    const node = document.createElementNS(SVG_NS, "circle");
    node.setAttribute("cx", cx);
    node.setAttribute("cy", cy);
    node.setAttribute("r", r);
    node.setAttribute("fill", fill);
    if (stroke !== "none") {
      node.setAttribute("stroke", stroke);
      node.setAttribute("stroke-width", strokeWidth);
    }
    return node;
  }

  function path(d, fill) {
    const node = document.createElementNS(SVG_NS, "path");
    node.setAttribute("d", d);
    node.setAttribute("fill", fill);
    return node;
  }

  function phasePath(kind, r) {
    const narrow = r * 0.42;
    const wide = r * 1.45;

    if (kind === "waxing-crescent") {
      return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${narrow} ${r} 0 0 0 0 ${-r}`;
    }
    if (kind === "first-quarter") {
      return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} Z`;
    }
    if (kind === "waxing-gibbous") {
      return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${wide} ${r} 0 0 1 0 ${-r}`;
    }
    if (kind === "waning-gibbous") {
      return `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} A ${wide} ${r} 0 0 0 0 ${-r}`;
    }
    if (kind === "last-quarter") {
      return `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} Z`;
    }
    return `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} A ${narrow} ${r} 0 0 1 0 ${-r}`;
  }

  function moonPhaseForDate(date) {
    if (!date) {
      return { label: "Luna", kind: "full" };
    }

    const selected = new Date(`${date}T12:00:00Z`).getTime();
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
    const synodicMonthMs = 29.530588853 * 24 * 60 * 60 * 1000;
    const age = ((selected - knownNewMoon) % synodicMonthMs + synodicMonthMs) % synodicMonthMs;
    const fraction = age / synodicMonthMs;

    if (fraction < 0.03 || fraction >= 0.97) return { label: "Luna nueva", kind: "new" };
    if (fraction < 0.22) return { label: "Creciente", kind: "waxing-crescent" };
    if (fraction < 0.28) return { label: "Cuarto creciente", kind: "first-quarter" };
    if (fraction < 0.47) return { label: "Gibosa creciente", kind: "waxing-gibbous" };
    if (fraction < 0.53) return { label: "Luna llena", kind: "full" };
    if (fraction < 0.72) return { label: "Gibosa menguante", kind: "waning-gibbous" };
    if (fraction < 0.78) return { label: "Cuarto menguante", kind: "last-quarter" };
    return { label: "Menguante", kind: "waning-crescent" };
  }
})();
