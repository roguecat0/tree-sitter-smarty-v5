<?php
// Controlled test inputs only. Unlike reference.php this uses Smarty's actual
// compiler and (in render mode) execution, including PHP precedence/block checks.
require __DIR__ . '/../vendor/autoload.php';
$input = json_decode($argv[1], true, 512, JSON_THROW_ON_ERROR);
if (!in_array($input['mode'], ['render', 'compile'], true)) {
    throw new InvalidArgumentException('Unknown full-engine mode');
}
$dir = sys_get_temp_dir() . '/smarty-engine-' . bin2hex(random_bytes(12));
if (!mkdir($dir, 0700)) { throw new RuntimeException('Cannot create compile directory'); }
$smarty = new \Smarty\Smarty();
$smarty->setCompileDir($dir);
$smarty->assign($input['values'] ?? []);
// Fixed test data can expose primitive fields without application classes.
foreach (($input['objects'] ?? []) as $name => $properties) {
    $smarty->assign($name, (object) $properties);
}
$error = null;
$result = null;
try {
    $template = $smarty->createTemplate('string:' . $input['source']);
    if ($input['mode'] === 'render') { $result = $template->fetch(); }
    else { $template->compileTemplateSource(); $result = 'compiled'; }
} catch (Throwable $exception) {
    $error = ['type' => get_class($exception), 'message' => $exception->getMessage()];
} finally {
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($files as $file) {
        if ($file->isDir()) { rmdir($file->getPathname()); }
        else { unlink($file->getPathname()); }
    }
    rmdir($dir);
}
echo json_encode(['version' => \Smarty\Smarty::SMARTY_VERSION, 'result' => $result, 'error' => $error], JSON_THROW_ON_ERROR);
