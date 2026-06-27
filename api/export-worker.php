<?php
declare(strict_types=1);

require __DIR__ . '/export-lib.php';

$jobId = '';
if (PHP_SAPI === 'cli') {
    $jobId = mm_clean_job_id((string) ($argv[1] ?? ''));
} else {
    $jobId = mm_clean_job_id((string) ($_GET['id'] ?? ''));
}

if ($jobId === '') {
    if (PHP_SAPI !== 'cli') {
        mm_json_response(['ok' => false, 'error' => 'ID invalido.'], 400);
    }
    exit(1);
}

mm_run_export_job($jobId);

if (PHP_SAPI !== 'cli') {
    mm_json_response(['ok' => true, 'job_id' => $jobId]);
}
