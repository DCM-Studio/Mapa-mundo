<?php
declare(strict_types=1);

require __DIR__ . '/export-lib.php';

mm_ensure_dirs();
mm_cleanup_old_exports();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    mm_json_response(['ok' => false, 'error' => 'Metodo no permitido.'], 405);
    exit;
}

$jobId = mm_new_job_id();
$job = [
    'state' => 'queued',
    'created_at' => gmdate('c'),
    'updated_at' => gmdate('c'),
    'total_events' => 0,
    'total_cities' => 0,
    'completed_cities' => 0,
    'rows_written' => 0,
];
mm_write_job($jobId, $job);

$spawned = false;
if (function_exists('exec')) {
    $php = PHP_BINARY ?: 'php';
    $worker = __DIR__ . '/export-worker.php';
    $cmd = escapeshellcmd($php) . ' ' . escapeshellarg($worker) . ' ' . escapeshellarg($jobId) . ' > /dev/null 2>&1 &';
    @exec($cmd, $output, $code);
    $spawned = $code === 0;
}

mm_json_response([
    'ok' => true,
    'job_id' => $jobId,
    'state' => 'queued',
    'background' => $spawned ? 'exec' : 'deferred',
]);

if (!$spawned) {
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        @ob_flush();
        @flush();
    }
    mm_run_export_job($jobId);
}
