# Task 045: Neovim editor queries

Scope: existing Smarty syntax highlighting, combined HTML injection (including
literal bodies), folds for recognized blocks, and documented Neovim 0.11 setup.
No syntax or tree changes. Unknown tags remain independent. Indentation,
textobjects, symbol indexing and local-variable semantics are deferred.

Specify capture and range checks before adding queries. Manually specify a tree
for Smarty output inside a script, assert field-specific highlighting and HTML
content exclusions, then verify actual nested HTML/JavaScript/CSS LanguageTrees
in headless Neovim. Break and repair an output inside a script and compare fresh
and incremental trees. Test literal content and tag splits within HTML attributes.

HTML uses one combined pattern for text and literal_content. Nested script/style captures can span Smarty holes in Neovim 0.11;
Smarty highlights must win with priority 110 over host defaults of 100. Do not inject PHP or recursively inject Smarty into script raw text.

References: [Twig queries](https://github.com/gbprod/tree-sitter-twig/tree/main/queries),
[Jinja HTML injection](https://github.com/geigerzaehler/tree-sitter-jinja2/blob/main/queries/htmljinja/injections.scm),
[Neovim injections](https://neovim.io/doc/user/treesitter.html#treesitter-language-injections).

Status: complete within the stated editor-query scope.

## Implementation evidence

Added canonical highlight/injection/fold queries and checked identical Neovim
runtime copies under `queries/smarty_v5/`. The Node binding already reads canonical
highlights and injections. Package metadata now includes the nested query files;
`npm pack --dry-run --json` lists all six. Tree-sitter metadata declares the
highlight and injection files. Setup is documented in `docs/neovim.md`.

Failing-first query checks: `/tmp/task045-failing-first.log` (4/4 failed because
queries did not exist). Focused checks pass (5/5), including manually specified
script output tree, contextual fields, combined content ranges, folds,
interpolation, incremental edits, priorities and runtime-copy consistency.
No grammar, scanner, generated tree shape, or existing expectation changed.

Headless integration command:
`SMARTY_EDITOR_DEPS=/tmp/smarty-editor-deps nvim --headless -u NONE -l test/neovim-editor.lua`
passed on Neovim 0.11.6. External parser revisions:
HTML `73a3947324f6efddf9e17c0ea58d454843590cc0`,
JavaScript `58404d8cf191d69f2674a8fd507bd5776f46cb11`,
CSS `dda5cfc5722c429eaba1c910ca32c2c0c5bb1a3f`.
The check supplies basic upstream HTML injections and exercises real nested
LanguageTrees, overlapping JS strings, Smarty priority, literal opacity and
boundary edits. It does not validate a particular plugin's specialized script
type queries or guarantee valid JS/CSS across dynamic template constructs.

Application before/after reports are `/tmp/task045-before-application.json` and
`/tmp/task045-after-application.json`: **467/467 clean, zero errors** before and
after, with identical parser hash and per-file reports. No newly clean files
need structural review. Separately reported upstream core is **33/33 clean**
(`/tmp/task045-upstream-core.json`), and upstream demo is **1/1 clean**
(`/tmp/task045-upstream-example.json`). These parse results are not proof of
complete language/editor coverage. Known grammar exclusions remain in the
feature inventory. Indentation, textobjects, locals and symbol queries are
separate work; priority overrides in user host queries must stay below 110.

Full acceptance: `npm test` exited 0, regenerated/rebuilt first, passed
394/394 expected-tree cases and 559/559 Node checks, and caught 18/18 deliberate
grammar mutations. Log: `/tmp/task045-npm-test.log`, SHA-256
`f040aec69341533ff890af5b633c463cae4a55de30038647bfda06da91c58160`.
The runtime-copy/priority check was added after that run's Node phase;
`node --test test/editor-queries.test.mjs` subsequently passed all 5/5 editor
checks against the final files. The headless Neovim check was replayed successfully.
`git diff --check` passed. Local checks do not substitute for external review.
