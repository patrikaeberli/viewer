<?php

header("Content-Type: application/json");

// Runtime hints (actual limits are set in .htaccess / php.ini)
@ini_set('memory_limit',       '512M');
@ini_set('max_execution_time', '300');

$action = $_GET['action'] ?? '';

// ── Upload ────────────────────────────────────────────────

if ($action === 'upload') {
    if (!isset($_FILES['file'])) { echo json_encode(["error" => "No file"]); exit; }
    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $msgs = [
            UPLOAD_ERR_INI_SIZE   => 'File too large (php.ini limit — check .htaccess)',
            UPLOAD_ERR_FORM_SIZE  => 'File too large (form limit)',
            UPLOAD_ERR_PARTIAL    => 'Upload incomplete',
            UPLOAD_ERR_NO_FILE    => 'No file sent',
            UPLOAD_ERR_NO_TMP_DIR => 'No temp directory',
            UPLOAD_ERR_CANT_WRITE => 'Cannot write to disk',
        ];
        echo json_encode(["error" => $msgs[$file['error']] ?? "Upload error {$file['error']}"]);
        exit;
    }
    $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $name = time() . '-' . mt_rand(100, 999) . '.' . $ext;
    $dest = "assets/" . $name;
    if (!is_dir("assets")) mkdir("assets", 0755, true);
    move_uploaded_file($file['tmp_name'], $dest);
    echo json_encode(["path" => $dest, "name" => $name, "size" => filesize($dest)]);
    exit;
}

// ── Load ──────────────────────────────────────────────────

if ($action === 'load') {
    $path = "state.json";
    echo file_exists($path)
        ? file_get_contents($path)
        : json_encode(["canvas" => ["w" => 1920, "h" => 1080], "layers" => []]);
    exit;
}

// ── Save ──────────────────────────────────────────────────

if ($action === 'save') {
    $data = file_get_contents("php://input");
    if (json_decode($data) === null) { echo json_encode(["error" => "Invalid JSON"]); exit; }
    file_put_contents("state.json", $data);
    echo json_encode(["ok" => true]);
    exit;
}

// ── List assets ───────────────────────────────────────────

if ($action === 'assets') {
    $files = glob("assets/*") ?: [];
    $result = [];
    foreach ($files as $f) {
        if (!is_file($f)) continue;
        $result[] = [
            'path' => $f,
            'name' => basename($f),
            'size' => filesize($f),
            'type' => mime_content_type($f) ?: 'application/octet-stream',
        ];
    }
    usort($result, fn($a, $b) => strcmp($b['name'], $a['name']));
    echo json_encode($result);
    exit;
}

// ── Delete asset ──────────────────────────────────────────

if ($action === 'delete_asset') {
    $path = $_POST['path'] ?? '';
    $real = realpath($path);
    $base = realpath("assets");
    if ($real && $base && strpos($real, $base . DIRECTORY_SEPARATOR) === 0 && is_file($real)) {
        unlink($real);
        echo json_encode(["ok" => true]);
    } else {
        echo json_encode(["error" => "Invalid path"]);
    }
    exit;
}

// ── Get refresh command ───────────────────────────────────

if ($action === 'get_refresh_cmd') {
    $path = "refresh_cmd.txt";
    echo json_encode(["cmd" => file_exists($path) ? trim(file_get_contents($path)) : ""]);
    exit;
}

// ── Save refresh command ──────────────────────────────────

if ($action === 'set_refresh_cmd') {
    $data = json_decode(file_get_contents("php://input"), true);
    $cmd  = trim($data['cmd'] ?? '');
    file_put_contents("refresh_cmd.txt", $cmd);
    echo json_encode(["ok" => true]);
    exit;
}

// ── Run refresh command ───────────────────────────────────

if ($action === 'run_refresh') {
    $path = "refresh_cmd.txt";
    if (!file_exists($path)) { echo json_encode(["error" => "No refresh command configured"]); exit; }
    $cmd = trim(file_get_contents($path));
    if ($cmd === '') { echo json_encode(["error" => "Refresh command is empty"]); exit; }
    $output = []; $code = 0;
    exec(escapeshellcmd($cmd) . " 2>&1", $output, $code);
    echo json_encode(["ok" => $code === 0, "code" => $code, "output" => implode("\n", $output)]);
    exit;
}

// ── Check for updates ─────────────────────────────────────

if ($action === 'check_update') {
    $dir = __DIR__;
    $branch = trim(shell_exec("cd " . escapeshellarg($dir) . " && git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print \$NF}'") ?? '');
    if (!$branch) $branch = 'main';

    shell_exec("cd " . escapeshellarg($dir) . " && git fetch origin 2>&1");

    $currentHash = trim(shell_exec("cd " . escapeshellarg($dir) . " && git rev-parse --short HEAD 2>/dev/null") ?? '');
    $currentDate = trim(shell_exec("cd " . escapeshellarg($dir) . " && git log -1 --format='%ci' HEAD 2>/dev/null") ?? '');
    $behind      = (int) trim(shell_exec("cd " . escapeshellarg($dir) . " && git rev-list HEAD..origin/{$branch} --count 2>/dev/null") ?? '0');
    $log         = trim(shell_exec("cd " . escapeshellarg($dir) . " && git log HEAD..origin/{$branch} --oneline --no-merges 2>/dev/null") ?? '');
    $commits     = $log ? array_values(array_filter(explode("\n", $log))) : [];

    echo json_encode([
        "up_to_date"    => $behind === 0,
        "behind"        => $behind,
        "current_hash"  => $currentHash,
        "current_date"  => $currentDate,
        "branch"        => $branch,
        "commits"       => $commits,
        "changelog_url" => "https://github.com/patrikaeberli/viewer/commits/{$branch}",
    ]);
    exit;
}

// ── Run update ────────────────────────────────────────────

if ($action === 'do_update') {
    $dir    = __DIR__;
    $branch = trim(shell_exec("cd " . escapeshellarg($dir) . " && git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print \$NF}'") ?? '');
    if (!$branch) $branch = 'main';

    // Backup user-owned files before reset
    $stateBackup = file_exists($dir . '/state.json')       ? file_get_contents($dir . '/state.json')       : null;
    $refreshCmd  = file_exists($dir . '/refresh_cmd.txt')  ? file_get_contents($dir . '/refresh_cmd.txt')  : null;

    // assets/ is not git-tracked → survives reset automatically
    $output = []; $code = 0;
    exec("cd " . escapeshellarg($dir) . " && git fetch origin 2>&1 && git reset --hard origin/{$branch} 2>&1", $output, $code);

    // Restore user data
    if ($stateBackup !== null) file_put_contents($dir . '/state.json', $stateBackup);
    if ($refreshCmd  !== null) file_put_contents($dir . '/refresh_cmd.txt', $refreshCmd);

    shell_exec("chown -R www-data:www-data " . escapeshellarg($dir) . " 2>/dev/null");

    $newHash = trim(shell_exec("cd " . escapeshellarg($dir) . " && git rev-parse --short HEAD 2>/dev/null") ?? '');

    echo json_encode([
        "ok"       => $code === 0,
        "code"     => $code,
        "output"   => implode("\n", $output),
        "new_hash" => $newHash,
    ]);
    exit;
}

echo json_encode(["error" => "Unknown action"]);
