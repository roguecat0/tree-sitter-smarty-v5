# Feature inventory

`Supported` means the explicitly bounded form has acceptance evidence, not that
all Smarty variants are covered. `Partial` means only the described forms work.
`Ready` means a brief is available; it does not mean implementation has started.

| Feature | Status and supported boundary | Evidence / next task |
| --- | --- | --- |
| Text/output boundaries | Partial: ordinary text and expression output; no raw braces/auto-literal | [initial trees](../test/corpus/initial.txt) |
| Variables/numbers | Partial: simple variable names, unsigned decimal numbers | initial trees |
| Strings | Partial: simple quotes/escapes; no interpolation (see [quoted-comment limitation](tasks/002-comments.md#reference-boundary-clarification)) | initial trees, quoted-brace case |
| Arithmetic | Partial: binary `+ - * / %`, parentheses; no unary/boolean/comparison syntax | initial trees; precedence mutation; operator-field check |
| Generic tags | Partial: names, positional expressions, named attributes; no bare-word values | initial trees; [reference tests](../test/reference.test.mjs) |
| Custom closing tags | Supported as independent tags; pairing deliberately unspecified | initial mismatched-name case |
| Modifiers | Partial: chains and simple arguments; unrestricted names | initial trees; renamed-extension checks |
| If/elseif/else | Partial: nested blocks using supported expression forms | initial trees; [edit tests](../test/incremental.test.mjs) |
| Config variables | Partial: static ASCII names in expressions; no dynamic names/indexing | [001](tasks/001-config-variables.md) |
| Smarty comments | Supported: `{* ... *}` through first terminator; non-nesting | [002](tasks/002-comments.md) |
| Object properties | Partial: static ASCII `->name` chains from variables; no calls/dynamic members | [003](tasks/003-object-properties.md) |
| Object method calls | Ready: static names, ordinary arguments, property/call chains | [004](tasks/004-object-method-calls.md) |
| Standalone function calls | Unimplemented; excluded from 004 | Separate brief needed |
| Dot/index access, arrays | Unimplemented | Separate briefs needed |
| Comparison/boolean/unary operators | Ready: symbolic comparisons, `&&`/`\|\|`, prefix `! + -`; no word aliases | [005](tasks/005-condition-operators.md) |
| Foreach blocks | Ready: modern `as` headers, optional key and `foreachelse` | [006](tasks/006-foreach-blocks.md) |
| Other built-in blocks | Unimplemented structurally; some names parse as generic tags | Inheritance, capture, etc. need explicit contracts |
| Literal blocks/auto-literal | Unimplemented | Separate boundary/recovery tasks |
| Configurable delimiters | Unimplemented | Design decision needed |
| HTML injections/queries | Unimplemented | Separate editor integration milestone |
| Generic custom-block nesting | Deferred by design | Keep custom tags independent |

## Initial corpus observation

On 2026-09-19, the initial report measured **467 files: 6 without parse errors,
461 with errors**. Among failing files, lexical hints found config variables in
412, object access in 412, foreach in 244, comparisons in 236, dot access in 187,
comments in 132, custom switch in 10, and literal in 3. Counts overlap and are
not proven causes. Regenerate the report for current evidence.

The six clean files are not promoted wholesale: some contain `block`/`extends`
that our generic rules accept without understanding inheritance. The first briefs
favor small independent features over promising to clear the most files at once.

Tasks 001, 002, and 003 are complete as separate changes within their bounded
scopes. Implement [004](tasks/004-object-method-calls.md), then
[005](tasks/005-condition-operators.md), then [006](tasks/006-foreach-blocks.md)
as separate verified changes. These briefs are ready, not implemented. Each
requires its own failing fixtures, acceptance run, corpus comparison and evidence
update. Standalone functions, dot/index access, constants, interpolation and
literal blocks still need separate briefs.

## Config variables evidence (2026-09-22)

Task 001 passes `npm test`: 15 trees, 27 Node checks, 3 mutation checks.
Identical hashes across 467 local files: **6 → 13 clean**, **461 → 454 failing**,
with no clean-to-failing regressions. See [001](tasks/001-config-variables.md).

## Comments evidence (2026-09-22)

Task 002 passes `npm test`: 25 trees, 40 Node checks, 4 mutation checks.
Identical hashes across 467 local files: **13 → 15 clean**, **454 → 452 failing**,
with no clean-to-failing regressions. See [002](tasks/002-comments.md).

## Object properties evidence (2026-09-22)

Task 003 passes `npm test`: 37 trees, 57 Node checks, 5 mutation checks.
Identical hashes across 467 local files: **15 → 15 clean**, **452 → 452 failing**,
with no clean-to-failing regressions. Static property structure is verified by
explicit trees, including the minimized receiver from `toolbar.tpl`; method
calls still prevent many full templates from parsing. See [003](tasks/003-object-properties.md).

Across all three tasks the local result is **6 → 15 clean**, **461 → 452 failing**.
Clean-file counts are triage evidence, not verified language coverage.
