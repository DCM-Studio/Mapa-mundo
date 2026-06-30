"use strict";

(() => {
  const api = window.MapaMundoStaticData;

  if (!api || api.__activeEpicenterMapPatch) {
    return;
  }

  api.__activeEpicenterMapPatch = true;
  api.getAllCatalogCities = function getAllCatalogCities() {
    return combineCities(this.baseCities || [], this.earthquakeEpicenterCities || []);
  };
  api.getCities = function getCities() {
    return combineCities(this.baseCities || [], getActiveEpicenterCities(this.earthquakeEpicenterCities || []));
  };

  const originalSetEarthquakeEpicenters = api.setEarthquakeEpicenters?.bind(api);
  if (originalSetEarthquakeEpicenters) {
    api.setEarthquakeEpicenters = function setEarthquakeEpicenters(events) {
      const epicenters = originalSetEarthquakeEpicenters(events);
      window.dispatchEvent(new CustomEvent("mapaMundo:activeCitiesChanged", {
        detail: {
          baseCities: this.baseCities?.length || 0,
          activeEpicenterCities: getActiveEpicenterCities(this.earthquakeEpicenterCities || []).length,
          totalCities: this.getCities().length,
          totalCatalogCities: this.getAllCatalogCities().length,
        },
      }));
      return epicenters;
    };
  }

  function getActiveEpicenterCities(epicenterCities) {
    const selected = getSelectedEarthquakePreset();
    if (!selected) return [];

    const selectedId = String(selected.value || "");
    const selectedDate = selected.dataset.date || "";
    return epicenterCities.filter((city) => {
      const idMatches = selectedId && String(city.earthquakeId || "") === selectedId;
      const dateMatches = selectedDate && String(city.earthquakeDate || "").slice(0, 10) === selectedDate;
      return idMatches || dateMatches;
    }).slice(0, 1);
  }

  function getSelectedEarthquakePreset() {
    const select = document.getElementById("earthquakePresetSelect");
    const option = select?.selectedOptions?.[0];
    return option?.dataset?.date ? option : null;
  }

  function combineCities(baseCities, epicenterCities) {
    const combined = [];
    const seen = new Set();

    [...baseCities, ...epicenterCities].forEach((city) => {
      if (!city || !Number.isFinite(Number(city.lat)) || !Number.isFinite(Number(city.lon))) return;
      const key = `${String(city.name || "").trim().toLowerCase()}|${String(city.country || "").trim().toLowerCase()}|${Number(city.lat).toFixed(4)}|${Number(city.lon).toFixed(4)}`;
      if (seen.has(key)) return;
      seen.add(key);
      combined.push(city);
    });

    return combined;
  }
})();
