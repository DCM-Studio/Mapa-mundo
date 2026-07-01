"use strict";

(() => {
  const buttonId = "exportEarthquakeCatalogCsvButton";
  const statusKey = "mapa_mundo_m7_export_job_id";
  const latestJobToken = "__latest__";
  const statusText = document.getElementById("statusText");
  const progress = document.getElementById("loadProgress");
  let pollTimer = 0;

  window.MapaMundoServerCatalogExport = true;
  window.MapaMundoCatalogExportHandlesDownload = true;

  document.addEventListener("click", handleExportClick, true);
  window.addEventListener("DOMContentLoaded", resumeSavedJob);
  resumeSavedJob();

  function handleExportClick(event) {
    const button = event.target?.closest?.(`#${buttonId}`);
    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    void startExport(button);
  }

  async function startExport(button) {
    clearPreparedLink();
    setBusy(button, true);
    setStatus("Creando exportacion historica en servidor...", 0.02);

    try {
      const response = await fetch(`api/start-export.php?start=1&t=${Date.now()}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Servidor respondio ${response.status}.`);
      }

      localStorage.setItem(statusKey, payload.job_id);
      setStatus("Exportacion creada. Puedes cerrar esta pagina y volver despues.", 0.05);
      pollJob(payload.job_id, button);
    } catch (error) {
      console.error(error);
      setStatus(`No se pudo iniciar la exportacion historica: ${error.message}`, 0);
      setBusy(button, false);
    }
  }

  function resumeSavedJob() {
    const button = document.getElementById(buttonId);
    if (!button) {
      return;
    }

    const jobId = localStorage.getItem(statusKey);
    pollJob(jobId || latestJobToken, button, true, { silentMissing: !jobId });
  }

  function pollJob(jobId, button, isResume = false, options = {}) {
    window.clearTimeout(pollTimer);

    if (isResume && !options.silentMissing) {
      setStatus("Revisando exportacion historica pendiente...", 0.05);
    }

    const tick = async () => {
      try {
        const url =
          jobId === latestJobToken
            ? `api/export-status.php?latest=1&t=${Date.now()}`
            : `api/export-status.php?id=${encodeURIComponent(jobId)}&t=${Date.now()}`;
        const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
        if (response.status === 404 && options.silentMissing) {
          return;
        }

        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || `Servidor respondio ${response.status}.`);
        }

        renderJobStatus(payload, button);
        if (payload.state === "ready" || payload.state === "failed") {
          return;
        }

        pollTimer = window.setTimeout(tick, 5000);
      } catch (error) {
        console.error(error);
        setStatus(`No se pudo consultar la exportacion historica: ${error.message}`, 0);
        setBusy(button, false);
      }
    };

    void tick();
  }

  function renderJobStatus(payload, button) {
    const total = Number(payload.total_cities || 0);
    const completed = Number(payload.completed_cities || 0);
    const fraction = total ? Math.max(0.05, Math.min(0.98, completed / total)) : 0.05;

    if (payload.state === "ready") {
      localStorage.setItem(statusKey, payload.job_id);
      setStatus(`CSV historico listo: ${payload.rows_written || 0} filas.`, 1);
      showPreparedLink(payload);
      setBusy(button, false);
      return;
    }

    if (payload.state === "failed") {
      setStatus(`La exportacion historica fallo: ${payload.error || "sin detalle"}`, 0);
      localStorage.removeItem(statusKey);
      setBusy(button, false);
      return;
    }

    setBusy(button, true);
    setStatus(`Generando CSV historico en servidor: ${completed}/${total || "..."} ciudades...`, fraction);
  }

  function showPreparedLink(payload) {
    const button = document.getElementById(buttonId);
    if (!button?.parentElement || !payload.download_url) {
      return;
    }

    let link = document.getElementById("catalogAsyncDownloadLink");
    if (!link) {
      link = document.createElement("a");
      link.id = "catalogAsyncDownloadLink";
      link.className = "secondary-button";
      link.textContent = "Descargar archivo listo";
      button.insertAdjacentElement("afterend", link);
    }

    const separator = payload.download_url.includes("?") ? "&" : "?";
    link.href = `${payload.download_url}${separator}v=${encodeURIComponent(payload.updated_at || Date.now())}`;
    link.download = payload.filename || "";
    link.hidden = false;
  }

  function clearPreparedLink() {
    const link = document.getElementById("catalogAsyncDownloadLink");
    if (link) {
      link.hidden = true;
      link.removeAttribute("href");
      link.removeAttribute("download");
    }
  }

  function setBusy(button, isBusy) {
    if (!button) {
      return;
    }

    button.disabled = isBusy;
    button.textContent = isBusy ? "Preparando CSV M7+..." : "Exportar CSV M7+ historico";
  }

  function setStatus(message, value) {
    if (statusText) {
      statusText.textContent = message;
    }
    if (progress) {
      progress.value = value;
    }
  }
})();
