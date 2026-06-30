"use strict";

(() => {
  const api = window.MapaMundoStaticData;
  if (!api || api.__cityScopeInstalled) return;

  api.__cityScopeInstalled = true;
  api.historicalEpicenterCities = Array.isArray(api.historicalEpicenterCities)
    ? api.historicalEpicenterCities
    : [];
  api.earthquakeEpicenterCities = [];

  api.getVisibleCities = () => dedupeCities(baseCities());
  api.getHistoricalAnalysisCities = () => dedupeCities([...baseCities(), ...(api.historicalEpicenterCities || [])]);
  api.getCities = () => api.getVisibleCities();

  api.setEarthquakeEpicenters = (events) => {
    api.historicalEpicenterCities = normalizeEpicenterCities(events || []);
    api.earthquakeEpicenterCities = [];

    window.dispatchEvent(new CustomEvent("mapaMundo:citiesChanged", {
      detail: {
        baseCities: baseCities().length,
        visibleCities: api.getVisibleCities().length,
        epicenterCities: api.historicalEpicenterCities.length,
        historicalAnalysisPoints: api.getHistoricalAnalysisCities().length,
      },
    }));

    return api.historicalEpicenterCities;
  };

  function baseCities() {
    return Array.isArray(api.baseCities) ? api.baseCities.slice() : [];
  }

  function normalizeEpicenterCities(events) {
    const byLocation = new Map();

    events.forEach((event) => {
      const latitude = Number(event.latitude);
      const longitude = Number(event.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const place = String(event.place || "Ubicacion USGS no informada").trim();
      const locationKey = `${latitude.toFixed(3)}|${longitude.toFixed(3)}|${place.toLowerCase()}`;
      if (byLocation.has(locationKey)) return;

      byLocation.set(locationKey, {
        name: `Epicentro M7+ - ${place}`,
        country: "USGS",
        lat: latitude,
        lon: longitude,
        source: "USGS Earthquake Catalog API",
        earthquakeId: event.id || "",
        earthquakeDate: event.dateIso || event.date || "",
        earthquakeMagnitude: Number.isFinite(Number(event.magnitude)) ? Number(event.magnitude) : "",
      });
    });

    return Array.from(byLocation.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function dedupeCities(cities) {
    const seen = new Set();
    return cities.filter((city) => {
      if (!city || !Number.isFinite(Number(city.lat)) || !Number.isFinite(Number(city.lon))) return false;
      const key = `${String(city.name || "").trim().toLowerCase()}|${String(city.country || "").trim().toLowerCase()}|${Number(city.lat).toFixed(4)}|${Number(city.lon).toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
})();
