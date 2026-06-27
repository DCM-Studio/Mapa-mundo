<?php
declare(strict_types=1);

require __DIR__ . '/export-lib.php';

mm_ensure_dirs();

$jobId = mm_clean_job_id((string) ($_GET['id'] ?? ''));
if ($jobId === '') {
    mm_json_response(['ok' => false, 'error' => 'ID invalido.'], 400);
    exit;
}

$job = mm_read_job($jobId);
if (!$job) {
    mm_json_response(['ok' => false, 'error' => 'Exportacion no encontrada.'], 404);
    exit;
}

$job['ok'] = true;
mm_json_response($job);
