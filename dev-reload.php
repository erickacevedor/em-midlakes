<?php

/**
 * Dev-only live reload.
 *
 * Two jobs in one file:
 *   1. Included by index.php, which calls midlakes_reload_tag() before </body>.
 *   2. Hit directly by the browser as the polling endpoint:
 *        GET /dev-reload.php  ->  {"token":"<newest mtime>-<file count>"}
 *
 * It only ever runs on localhost / 127.0.0.1 / *.test / *.local, so it stays
 * inert on the live site. To rip it out completely: delete this file and
 * dev-reload.js, then remove the require line at the top of index.php and the
 * midlakes_reload_tag() call near the bottom.
 */

function midlakes_is_dev(): bool
{
    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');

    // Strip the port: "localhost:8080" -> "localhost", "[::1]:8080" -> "::1"
    if (str_starts_with($host, '[')) {
        $end  = strpos($host, ']');
        $host = $end === false ? $host : substr($host, 1, $end - 1);
    } elseif (substr_count($host, ':') === 1) {
        $host = strstr($host, ':', true);
    }

    return in_array($host, ['localhost', '127.0.0.1', '::1'], true)
        || str_ends_with($host, '.test')
        || str_ends_with($host, '.local');
}

/**
 * A cheap fingerprint of every source file we care about. The file count is in
 * there too, so deleting a file counts as a change just like editing one.
 */
function midlakes_watch_token(): string
{
    $watch = ['php', 'css', 'js', 'html', 'htm'];
    $skip  = ['images', 'vendor', 'node_modules', '.git', '.idea', '.vscode'];

    $tree = new RecursiveDirectoryIterator(__DIR__, FilesystemIterator::SKIP_DOTS);
    $tree = new RecursiveCallbackFilterIterator($tree, function ($file) use ($skip) {
        return $file->isDir()
            ? !in_array(strtolower($file->getFilename()), $skip, true)
            : true;
    });

    $newest = 0;
    $count  = 0;

    foreach (new RecursiveIteratorIterator($tree) as $file) {
        if (!$file->isFile() || !in_array(strtolower($file->getExtension()), $watch, true)) {
            continue;
        }
        $newest = max($newest, (int) $file->getMTime());
        $count++;
    }

    return $newest . '-' . $count;
}

function midlakes_reload_tag(): string
{
    if (!midlakes_is_dev()) {
        return '';
    }
    $v = (int) @filemtime(__DIR__ . '/dev-reload.js');

    return '<script src="dev-reload.js?v=' . $v . '" defer></script>';
}

// Requested directly? Then we're the polling endpoint, not a library.
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    header('Content-Type: application/json');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

    if (!midlakes_is_dev()) {
        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
        exit;
    }

    echo json_encode(['token' => midlakes_watch_token()]);
    exit;
}
