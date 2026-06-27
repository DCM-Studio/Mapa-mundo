"use strict";

(() => {
  const USGS_ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query";
  const select = document.getElementById("earthquakePresetSelect");
  const dateInput = document.getElementById("dateInput");
  const statusText = document.getElementById("statusText");

  if (!select || !dateInput) {
    return;
  }

  let applyingPreset = false;

  select.addEventListener("change", () => {
    const option = select.selectedOptions[0];
    const date = option?.dataset.date || "";

    if (!date) {
      return;
    }

    applyingPreset = true;
    dateInput.value = date;
    dateInput.dispatchEvent(new Event("change", { bubbles: true }));
    applyingPreset = false;

    if (statusText) {
      statusText.textContent = `Fecha seleccionada desde terremoto USGS: ${option.textContent}.`;
    }
  });

  dateInput.addEventListener("change", () => {
    if (applyingPreset) {
      return;
    }

    const matchingOption = Array.from(select.options).find((option) => option.dataset.date === dateInput.value);
    select.value = matchingOption ? matchingOption.value : "";
  });

  loadPresets();

  async function loadPresets() {
    setPlaceholder("Cargando terremotos M7+ desde 1900...");

    try {
      const payload = await fetchLatestEarthquakes();
      const events = (payload.features || []).map(normalizeFeature).filter(Boolean);

      if (!events.length) {
        setPlaceholder("Sin terremotos M7+ disponibles en USGS");
        return;
      }

      renderOptions(events);
    } catch (error) {
      console.error(error);
      setPlaceholder("No se pudieron cargar terremotos USGS");
    }
  }

  async function fetchLatestEarthquakes() {
    const url = new URL(USGS_ENDPOINT);
    url.searchParams.set("format", "geojson");
    url.searchParams.set("eventtype", "earthquake");
    url.searchParams.set("minmagnitude", "7");
    url.searchParams.set("starttime", "1900-01-01");
    url.searchParams.set("orderby", "time");
    url.searchParams.set("limit", "20000");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`USGS respondió ${response.status}.`);
    }

    return response.json();
  }

  function normalizeFeature(feature) {
    const properties = feature?.properties || {};
    const magnitude = Number(properties.mag);
    const time = Number(properties.time);

    if (!Number.isFinite(magnitude) || !Number.isFinite(time)) {
      return null;
    }

    const date = new Date(time);
    return {
      id: feature.id || `${time}-${magnitude}`,
      dateIso: date.toISOString().slice(0, 10),
      labelDate: date.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }),
      magnitude,
      place: properties.place || "Ubicación no informada",
    };
  }

  function renderOptions(events) {
    select.innerHTML = "";
    select.appendChild(new Option("Elegir fecha por terremoto M7+ desde 1900 (USGS)", ""));

    events.forEach((event, index) => {
      const option = new Option(
        `${event.labelDate} · M ${event.magnitude.toFixed(1)} · ${event.place}`,
        event.id || `earthquake-${index}`,
      );
      option.dataset.date = event.dateIso;
      select.appendChild(option);
    });

    const matchingOption = Array.from(select.options).find((option) => option.dataset.date === dateInput.value);
    select.value = matchingOption ? matchingOption.value : "";
  }

  function setPlaceholder(text) {
    select.innerHTML = "";
    select.appendChild(new Option(text, ""));
  }
})();
