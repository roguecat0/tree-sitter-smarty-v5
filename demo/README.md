# Smarty reference demo

From the project root:

```sh
php demo/smarty-reference.php
```

Add `--tokens` to also see the tokens Smarty's lexer produces.

The script sends five small templates through the installed Smarty lexer and
parser. A recording compiler captures tag names, arguments, modifiers, and
expressions before plugin lookup. No custom plugins are registered and no
template PHP is executed.

Each example checks its observations against an explicit expectation. A failed
check exits with status 1. `PASS` means the observation matched the expectation;
the malformed expression is expected to be rejected.

The expressions shown are PHP fragments produced by Smarty, not syntax trees.
The final example deliberately demonstrates a limitation: bypassing tag
compilation also bypasses block matching. A mismatched custom closing tag is
accepted by this demo.

This is a small demonstration of one reference we can use when testing our
future Tree-sitter parser. It does not implement or test that parser yet.
