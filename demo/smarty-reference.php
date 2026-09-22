<?php

// Run from the project root: php demo/smarty-reference.php
require __DIR__ . '/../vendor/autoload.php';

// Keep Smarty's lexer and parser, but record their compiler calls instead of
// looking up plugins or generating a runnable template.
class RecordingCompiler extends \Smarty\Compiler\Template
{
    public $events = [];

    public function compileTag($tag, $args, $parameter = [])
    {
        $this->events[] = ['tag' => $tag, 'arguments' => $args];
        return '';
    }

    public function compileModifier($modifierlist, $value)
    {
        $this->events[] = ['modifiers' => $modifierlist, 'expression' => $value];
        return $value;
    }

    public function compilePrintExpression($value, $attributes = [], $modifiers = null)
    {
        $this->events[] = ['output' => $value];
        return '';
    }
}

// Expected observations are written independently of the parser output.
$cases = [
    [
        'name' => 'Ordinary expression',
        'source' => '{$a + $b * $c}',
        'events' => [['output' => "\$_smarty_tpl->getValue('a')+\$_smarty_tpl->getValue('b')*\$_smarty_tpl->getValue('c')"]],
    ],
    [
        'name' => 'Custom tags with no plugins installed',
        'source' => '{switch $kind}{case value=1}One{/switch}',
        'events' => [
            ['tag' => 'switch', 'arguments' => ["\$_smarty_tpl->getValue('kind')"]],
            ['tag' => 'case', 'arguments' => [['value' => '1']]],
            ['tag' => 'switchclose', 'arguments' => []],
        ],
    ],
    [
        'name' => 'Custom modifier with no plugin installed',
        'source' => '{$price|my_money:2}',
        'events' => [
            ['modifiers' => [['my_money', '2']], 'expression' => "\$_smarty_tpl->getValue('price')"],
            ['output' => "\$_smarty_tpl->getValue('price')"],
        ],
    ],
    [
        'name' => 'Broken expression inside a custom tag',
        'source' => '{widget value=($a + )}',
        'events' => [],
        'error' => 'Unexpected ")"',
    ],
    [
        'name' => 'Known limitation: custom block matching is not checked',
        'source' => '{widget}{/different}',
        'events' => [
            ['tag' => 'widget', 'arguments' => []],
            ['tag' => 'differentclose', 'arguments' => []],
        ],
    ],
];

$failures = 0;
$showTokens = in_array('--tokens', $argv, true);
echo 'Smarty ' . \Smarty\Smarty::SMARTY_VERSION . " reference demo\n";
echo "Observing syntax; plugin execution and block validation are bypassed.\n";

foreach ($cases as $case) {
    $smarty = new \Smarty\Smarty();
    $compiler = new RecordingCompiler($smarty);
    $compiler->setTemplate($smarty->createTemplate('string:' . $case['source']));
    $lexer = new \Smarty\Lexer\TemplateLexer($case['source'], $compiler);
    $parser = new \Smarty\Parser\TemplateParser($lexer, $compiler);
    $compiler->setParser($parser);
    $tokens = [];
    $error = null;

    try {
        while ($lexer->yylex()) {
            $tokens[] = [$parser->yyTokenName[$lexer->token], $lexer->value];
            $parser->doParse($lexer->token, $lexer->value);
        }
        $parser->doParse(0, 0);
    } catch (\Smarty\CompilerException $exception) {
        $error = $exception->getMessage();
    }

    $expectedError = $case['error'] ?? null;
    $errorMatches = $expectedError === null
        ? $error === null
        : $error !== null && strpos($error, $expectedError) !== false;
    $passed = $errorMatches && $compiler->events === $case['events'];
    $failures += $passed ? 0 : 1;

    echo "\n" . ($passed ? 'PASS' : 'FAIL') . '  ' . $case['name'] . "\n";
    echo '  Template: ' . $case['source'] . "\n";
    foreach ($compiler->events as $event) {
        echo '  Observed: ' . json_encode($event, JSON_UNESCAPED_SLASHES) . "\n";
    }
    if ($error !== null) {
        echo '  Rejected: ' . $error . "\n";
    }
    if ($showTokens) {
        echo '  Tokens:   ' . json_encode($tokens, JSON_UNESCAPED_SLASHES) . "\n";
    }
    if (!$passed) {
        echo '  Expected: ' . json_encode($case['events'], JSON_UNESCAPED_SLASHES) . "\n";
        echo '  Expected error: ' . ($expectedError ?? '(none)') . "\n";
    }
}

echo "\n" . (count($cases) - $failures) . '/' . count($cases) . " checks passed.\n";
exit($failures === 0 ? 0 : 1);
