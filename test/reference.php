<?php

// One JSON argument: {"source": "..."}. One JSON response on stdout.
require __DIR__ . '/../vendor/autoload.php';

class SyntaxRecorder extends \Smarty\Compiler\Template
{
    public $events = [];

    public function compileTag($tag, $args, $parameter = [])
    {
        $arguments = [];
        foreach ($args as $argument) {
            $arguments[] = is_array($argument)
                ? ['name' => (string) array_key_first($argument)]
                : ['name' => null];
        }
        $this->events[] = ['kind' => 'tag', 'name' => $tag, 'arguments' => $arguments];
        return '';
    }

    public function compileModifier($modifierlist, $value)
    {
        foreach ($modifierlist as $modifier) {
            $this->events[] = ['kind' => 'modifier', 'name' => $modifier[0], 'arguments' => count($modifier) - 1];
        }
        return $value;
    }

    public function compilePrintExpression($value, $attributes = [], $modifiers = null)
    {
        $this->events[] = ['kind' => 'output'];
        return '';
    }
}

$input = json_decode($argv[1], true, 512, JSON_THROW_ON_ERROR);
$source = $input['source'];
$smarty = new \Smarty\Smarty();
$compiler = new SyntaxRecorder($smarty);
$compiler->setTemplate($smarty->createTemplate('string:' . $source));
$lexer = new \Smarty\Lexer\TemplateLexer($source, $compiler);
$parser = new \Smarty\Parser\TemplateParser($lexer, $compiler);
$compiler->setParser($parser);
$error = null;
try {
    while ($lexer->yylex()) {
        $parser->doParse($lexer->token, $lexer->value);
    }
    $parser->doParse(0, 0);
} catch (\Smarty\CompilerException $exception) {
    $error = $exception->getMessage();
}
echo json_encode(['version' => \Smarty\Smarty::SMARTY_VERSION, 'events' => $compiler->events, 'error' => $error], JSON_THROW_ON_ERROR);
