<?php
declare(strict_types=1);

require __DIR__ . '/export-lib.php';

mm_ensure_dirs();

$latestRequested = isset($_GET['latest']) && (string) $_GET['latest'] === '1';
$jobId = $latestRequested ? mm_latest_job_id() : mm_clean_job_id((string) ($_GET['id'] ?? ''));
if ($jobId === '') {
    mm_json_response(['ok' => false, 'error' => $latestRequested ? 'No hay exportaciones previas.' : 'ID invalido.'], $latestRequested ? 404 : 400);
    exit;
}

$job = mm_read_job($jobId);
if (!$job) {
    mm_json_response(['ok' => false, 'error' => 'Exportacion no encontrada.'], 404);
    exit;
}

if (($job['state'] ?? '') === 'queued' && mm_job_seconds_since_update($job) > 10) {
    $spawned = mm_spawn_export_worker($jobId);
    $job = mm_read_job($jobId) ?: $job;
    $job['restart_attempted'] = true;
    $job['restart_spawned'] = $spawned;
}

$job['ok'] = true;
mm_json_response($job);
