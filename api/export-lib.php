<?php
declare(strict_types=1);

const MM_WEATHER_START_DATE = '1981-01-01';
const MM_NASA_ENDPOINT = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const MM_USGS_ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const MM_PLATES_URL = 'https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json';
const MM_NEAR_PLATE_LIMIT_KM = 300.0;

function mm_root_dir(): string { return dirname(__DIR__); }
function mm_exports_dir(): string { return mm_root_dir() . '/exports'; }
function mm_jobs_dir(): string { return mm_exports_dir() . '/jobs'; }
function mm_cache_dir(): string { return mm_exports_dir() . '/cache'; }

function mm_ensure_dirs(): void {
    foreach ([mm_exports_dir(), mm_jobs_dir(), mm_cache_dir()] as $dir) {
        if (!is_dir($dir)) mkdir($dir, 0755, true);
    }
}

function mm_json_response(array $payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function mm_new_job_id(): string { return bin2hex(random_bytes(12)); }
function mm_clean_job_id(string $value): string { return preg_match('/^[a-f0-9]{24}$/', $value) ? $value : ''; }
function mm_job_path(string $jobId): string { return mm_jobs_dir() . '/' . $jobId . '.json'; }
function mm_latest_job_path(): string { return mm_jobs_dir() . '/latest-job.txt'; }

function mm_latest_job_id(): string {
    $path = mm_latest_job_path();
    if (is_file($path)) {
        $jobId = mm_clean_job_id(trim((string) file_get_contents($path)));
        if ($jobId !== '') return $jobId;
    }

    $latestPath = '';
    $latestTime = 0;
    foreach (glob(mm_jobs_dir() . '/*.json') ?: [] as $jobPath) {
        if (!is_file($jobPath)) continue;
        $modified = filemtime($jobPath) ?: 0;
        if ($modified > $latestTime) {
            $latestTime = $modified;
            $latestPath = $jobPath;
        }
    }

    return $latestPath === '' ? '' : mm_clean_job_id(basename($latestPath, '.json'));
}

function mm_write_latest_job_id(string $jobId): void {
    file_put_contents(mm_latest_job_path(), $jobId . "\n", LOCK_EX);
}

function mm_read_job(string $jobId): ?array {
    $path = mm_job_path($jobId);
    if (!is_file($path)) return null;
    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data : null;
}

function mm_write_job(string $jobId, array $job): void {
    $job['job_id'] = $jobId;
    $job['updated_at'] = gmdate('c');
    file_put_contents(mm_job_path($jobId), json_encode($job, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function mm_php_binary_candidates(): array {
    $candidates = ['/usr/local/bin/php', '/usr/bin/php', 'php'];
    if (defined('PHP_BINDIR') && PHP_BINDIR) $candidates[] = rtrim(PHP_BINDIR, '/') . '/php';
    if (defined('PHP_BINARY') && PHP_BINARY && stripos(basename(PHP_BINARY), 'lsphp') === false) $candidates[] = PHP_BINARY;
    return array_values(array_unique(array_filter($candidates)));
}

function mm_shell_command_part(string $command): string {
    return strpos($command, '/') !== false ? escapeshellarg($command) : escapeshellcmd($command);
}

function mm_spawn_export_worker(string $jobId): bool {
    if (!function_exists('exec')) return false;

    $worker = __DIR__ . '/export-worker.php';
    $logPath = mm_jobs_dir() . '/' . $jobId . '.log';

    foreach (mm_php_binary_candidates() as $php) {
        if (strpos($php, '/') !== false && !is_file($php)) continue;

        $cmd = mm_shell_command_part($php)
            . ' ' . escapeshellarg($worker)
            . ' ' . escapeshellarg($jobId)
            . ' > ' . escapeshellarg($logPath)
            . ' 2>&1 & echo $!';

        $output = [];
        $code = 1;
        @exec($cmd, $output, $code);
        $pid = trim((string) ($output[0] ?? ''));
        if ($code === 0 && $pid !== '') {
            $job = mm_read_job($jobId) ?: [];
            $job['worker_pid'] = $pid;
            $job['worker_started_at'] = gmdate('c');
            $job['worker_command'] = basename($php);
            mm_write_job($jobId, $job);
            return true;
        }
    }

    return false;
}

function mm_job_seconds_since_update(array $job): int {
    $updated = strtotime((string) ($job['updated_at'] ?? ''));
    return $updated ? max(0, time() - $updated) : PHP_INT_MAX;
}

function mm_http_get_json(string $url): array {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_USERAGENT => 'MapaMundo/1.0',
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($body === false || $status < 200 || $status >= 300) {
            throw new RuntimeException("No se pudo obtener JSON remoto ($status): $error");
        }
    } else {
        $context = stream_context_create(['http' => ['timeout' => 120, 'header' => "User-Agent: MapaMundo/1.0\r\n"]]);
        $body = file_get_contents($url, false, $context);
        if ($body === false) throw new RuntimeException('No se pudo obtener JSON remoto.');
    }
    $payload = json_decode($body, true);
    if (!is_array($payload)) throw new RuntimeException('La respuesta remota no es JSON valido.');
    return $payload;
}

function mm_load_base_cities(): array {
    $source = (string) file_get_contents(mm_root_dir() . '/assets/app.js');
    preg_match_all('/\{\s*name:\s*"([^"]+)",\s*country:\s*"([^"]+)",\s*lat:\s*(-?\d+(?:\.\d+)?),\s*lon:\s*(-?\d+(?:\.\d+)?)\s*\}/', $source, $matches, PREG_SET_ORDER);
    $cities = [];
    foreach ($matches as $match) {
        $cities[] = ['name' => $match[1], 'country' => $match[2], 'lat' => (float) $match[3], 'lon' => (float) $match[4]];
    }
    return $cities;
}

function mm_fetch_m7_events(): array {
    $url = MM_USGS_ENDPOINT . '?' . http_build_query([
        'format' => 'geojson', 'eventtype' => 'earthquake', 'minmagnitude' => '7',
        'starttime' => '1900-01-01', 'orderby' => 'time', 'limit' => '20000',
    ]);
    $payload = mm_http_get_json($url);
    $events = [];
    foreach (($payload['features'] ?? []) as $feature) {
        $properties = $feature['properties'] ?? [];
        $coordinates = $feature['geometry']['coordinates'] ?? [];
        $timeMs = isset($properties['time']) ? (int) $properties['time'] : 0;
        $magnitude = isset($properties['mag']) ? (float) $properties['mag'] : null;
        $lat = isset($coordinates[1]) ? (float) $coordinates[1] : null;
        $lon = isset($coordinates[0]) ? (float) $coordinates[0] : null;
        if (!$timeMs || $magnitude === null || $lat === null || $lon === null) continue;
        $timestamp = (int) floor($timeMs / 1000);
        $date = gmdate('Y-m-d', $timestamp);
        $events[] = [
            'id' => $feature['id'] ?? ($date . '-' . $magnitude),
            'date' => $date,
            'weather_date' => mm_previous_date($date),
            'time_iso' => gmdate('Y-m-d\TH:i:s\Z', $timestamp),
            'magnitude' => $magnitude,
            'place' => $properties['place'] ?? 'Ubicacion no informada',
            'latitude' => $lat,
            'longitude' => $lon,
            'depth' => isset($coordinates[2]) ? (float) $coordinates[2] : '',
        ];
    }
    return $events;
}

function mm_epicenter_cities(array $events): array {
    $seen = [];
    $cities = [];
    foreach ($events as $event) {
        $place = trim((string) $event['place']);
        $key = sprintf('%.3f|%.3f|%s', (float) $event['latitude'], (float) $event['longitude'], strtolower($place));
        if (isset($seen[$key])) continue;
        $seen[$key] = true;
        $cities[] = ['name' => 'Epicentro M7+ - ' . $place, 'country' => 'USGS', 'lat' => (float) $event['latitude'], 'lon' => (float) $event['longitude']];
    }
    return $cities;
}

function mm_combine_cities(array $baseCities, array $epicenterCities): array {
    $seen = [];
    $cities = [];
    foreach (array_merge($baseCities, $epicenterCities) as $city) {
        $key = strtolower(trim($city['name'])) . '|' . strtolower(trim($city['country'])) . '|' . sprintf('%.4f|%.4f', $city['lat'], $city['lon']);
        if (isset($seen[$key])) continue;
        $seen[$key] = true;
        $cities[] = $city;
    }
    return $cities;
}

function mm_previous_date(string $date): string {
    $value = new DateTimeImmutable($date . ' 00:00:00', new DateTimeZone('UTC'));
    return $value->modify('-1 day')->format('Y-m-d');
}

function mm_compact_date(string $date): string { return str_replace('-', '', $date); }

function mm_fetch_weather_range(array $city, string $startDate, string $endDate): array {
    $cacheKey = sha1($city['name'] . '|' . $city['country'] . '|' . $city['lat'] . '|' . $city['lon'] . '|' . $startDate . '|' . $endDate);
    $cachePath = mm_cache_dir() . '/weather-' . $cacheKey . '.json';
    if (is_file($cachePath)) {
        $cached = json_decode((string) file_get_contents($cachePath), true);
        if (is_array($cached)) return $cached;
    }
    $url = MM_NASA_ENDPOINT . '?' . http_build_query([
        'parameters' => 'T2M,RH2M,PS', 'community' => 'AG', 'longitude' => $city['lon'], 'latitude' => $city['lat'],
        'start' => mm_compact_date($startDate), 'end' => mm_compact_date($endDate), 'format' => 'JSON', 'time-standard' => 'UTC',
    ]);
    $payload = mm_http_get_json($url);
    $parameters = $payload['properties']['parameter'] ?? [];
    file_put_contents($cachePath, json_encode($parameters));
    return is_array($parameters) ? $parameters : [];
}

function mm_weather_value(array $weather, string $field, string $date): string {
    $ymd = mm_compact_date($date);
    if (!isset($weather[$field][$ymd])) return '';
    $value = (float) $weather[$field][$ymd];
    return $value > -900 ? (string) $value : '';
}

function mm_moon_phase(string $date): string {
    $selected = strtotime($date . ' 12:00:00 UTC') * 1000;
    $knownNewMoon = gmmktime(18, 14, 0, 1, 6, 2000) * 1000;
    $synodicMonthMs = 29.530588853 * 24 * 60 * 60 * 1000;
    $age = fmod(($selected - $knownNewMoon), $synodicMonthMs);
    if ($age < 0) $age += $synodicMonthMs;
    $fraction = $age / $synodicMonthMs;
    if ($fraction < 0.03 || $fraction >= 0.97) return 'Luna nueva';
    if ($fraction < 0.22) return 'Creciente';
    if ($fraction < 0.28) return 'Cuarto creciente';
    if ($fraction < 0.47) return 'Gibosa creciente';
    if ($fraction < 0.53) return 'Luna llena';
    if ($fraction < 0.72) return 'Gibosa menguante';
    if ($fraction < 0.78) return 'Cuarto menguante';
    return 'Menguante';
}

function mm_plate_segments(): array {
    try { $payload = mm_http_get_json(MM_PLATES_URL); } catch (Throwable $error) { return []; }
    $segments = [];
    foreach (($payload['features'] ?? []) as $feature) {
        $geometry = $feature['geometry'] ?? [];
        if (($geometry['type'] ?? '') === 'LineString') {
            mm_push_line_segments($segments, $geometry['coordinates'] ?? []);
        } elseif (($geometry['type'] ?? '') === 'MultiLineString') {
            foreach (($geometry['coordinates'] ?? []) as $line) mm_push_line_segments($segments, $line);
        }
    }
    return $segments;
}

function mm_push_line_segments(array &$segments, array $coordinates): void {
    for ($i = 1; $i < count($coordinates); $i++) {
        $start = $coordinates[$i - 1];
        $end = $coordinates[$i];
        if (isset($start[0], $start[1], $end[0], $end[1])) $segments[] = ['start' => $start, 'end' => $end];
    }
}

function mm_plate_distance_km(array $city, array $segments): ?float {
    $nearest = INF;
    foreach ($segments as $segment) {
        $distance = mm_distance_to_segment_km($city, $segment['start'], $segment['end']);
        if ($distance < $nearest) $nearest = $distance;
    }
    return is_finite($nearest) ? $nearest : null;
}

function mm_distance_to_segment_km(array $city, array $start, array $end): float {
    $lat0 = (float) $city['lat'];
    $cosLat = cos($lat0 * M_PI / 180);
    $ax = mm_wrapped_lon_delta((float) $start[0], (float) $city['lon']) * 111.32 * $cosLat;
    $ay = ((float) $start[1] - (float) $city['lat']) * 110.57;
    $bx = mm_wrapped_lon_delta((float) $end[0], (float) $city['lon']) * 111.32 * $cosLat;
    $by = ((float) $end[1] - (float) $city['lat']) * 110.57;
    $dx = $bx - $ax;
    $dy = $by - $ay;
    $lengthSquared = $dx * $dx + $dy * $dy;
    $t = $lengthSquared ? max(0, min(1, -($ax * $dx + $ay * $dy) / $lengthSquared)) : 0;
    $px = $ax + $t * $dx;
    $py = $ay + $t * $dy;
    return sqrt($px * $px + $py * $py);
}

function mm_wrapped_lon_delta(float $lon, float $origin): float {
    $delta = $lon - $origin;
    while ($delta > 180) $delta -= 360;
    while ($delta < -180) $delta += 360;
    return $delta;
}

function mm_run_export_job(string $jobId): void {
    ignore_user_abort(true);
    set_time_limit(0);
    mm_ensure_dirs();
    $job = mm_read_job($jobId);
    if (!$job) return;

    try {
        $events = mm_fetch_m7_events();
        $cities = mm_combine_cities(mm_load_base_cities(), mm_epicenter_cities($events));
        $weatherDates = array_values(array_filter(array_map(fn($event) => $event['weather_date'], $events), fn($date) => $date >= MM_WEATHER_START_DATE));
        sort($weatherDates);
        $startDate = $weatherDates[0] ?? MM_WEATHER_START_DATE;
        $endDate = $weatherDates ? $weatherDates[count($weatherDates) - 1] : MM_WEATHER_START_DATE;
        $segments = mm_plate_segments();
        $filename = 'mapa-mundo-terremotos-m7-desde-1900-' . gmdate('Y-m-d') . '-' . $jobId . '.csv';
        $tmpPath = mm_exports_dir() . '/' . $filename . '.tmp';
        $finalPath = mm_exports_dir() . '/' . $filename;

        $job['state'] = 'running';
        $job['total_events'] = count($events);
        $job['total_cities'] = count($cities);
        $job['completed_cities'] = 0;
        $job['rows_written'] = 0;
        $job['filename'] = $filename;
        mm_write_job($jobId, $job);

        $handle = fopen($tmpPath, 'w');
        if (!$handle) throw new RuntimeException('No se pudo crear el CSV temporal.');
        fputcsv($handle, ['terremoto_id','terremoto_fecha','terremoto_utc','terremoto_magnitud','terremoto_lugar','terremoto_latitud','terremoto_longitud','terremoto_profundidad_km','meteorologia_fecha','ciudad','pais','ciudad_latitud','ciudad_longitud','temperatura_promedio_c','humedad_promedio_pct','presion_atmosferica_kpa','fase_lunar','ciudad_cerca_limite_placa_300km','ciudad_distancia_limite_placa_km','fuente_meteorologica','fuente_sismos','fuente_placas','nota']);

        foreach ($cities as $index => $city) {
            $weather = $weatherDates ? mm_fetch_weather_range($city, $startDate, $endDate) : [];
            $plateDistance = $segments ? mm_plate_distance_km($city, $segments) : null;
            $nearPlate = $plateDistance !== null && $plateDistance <= MM_NEAR_PLATE_LIMIT_KM;
            foreach ($events as $event) {
                $weatherDate = $event['weather_date'];
                $weatherAvailable = $weatherDate >= MM_WEATHER_START_DATE;
                $note = $weatherAvailable ? 'Meteorologia correspondiente al dia previo al terremoto' : 'Sin datos meteorologicos NASA POWER para ' . $weatherDate . '; disponible desde ' . MM_WEATHER_START_DATE;
                fputcsv($handle, [$event['id'],$event['date'],$event['time_iso'],$event['magnitude'],$event['place'],$event['latitude'],$event['longitude'],$event['depth'],$weatherDate,$city['name'],$city['country'],$city['lat'],$city['lon'],$weatherAvailable ? mm_weather_value($weather, 'T2M', $weatherDate) : '',$weatherAvailable ? mm_weather_value($weather, 'RH2M', $weatherDate) : '',$weatherAvailable ? mm_weather_value($weather, 'PS', $weatherDate) : '',mm_moon_phase($weatherDate),$nearPlate ? 'si' : 'no',$plateDistance !== null ? number_format($plateDistance, 1, '.', '') : '',$weatherAvailable ? 'NASA POWER Daily API' : 'NASA POWER Daily API no disponible','USGS Earthquake Catalog API','PB2002 tectonic plate boundaries',$note]);
                $job['rows_written']++;
            }
            $job['completed_cities'] = $index + 1;
            mm_write_job($jobId, $job);
        }

        fclose($handle);
        rename($tmpPath, $finalPath);
        $job['state'] = 'ready';
        $job['download_url'] = 'exports/' . $filename;
        mm_write_job($jobId, $job);
        mm_write_latest_job_id($jobId);
    } catch (Throwable $error) {
        if (isset($handle) && is_resource($handle)) fclose($handle);
        $job['state'] = 'failed';
        $job['error'] = $error->getMessage();
        mm_write_job($jobId, $job);
    }
}

function mm_cleanup_old_exports(): void {
    $limit = time() - 3 * 24 * 60 * 60;
    foreach (glob(mm_exports_dir() . '/*.csv*') ?: [] as $path) {
        if (is_file($path) && filemtime($path) < $limit) @unlink($path);
    }
}
