# Feature inventory

`Supported` means the explicitly bounded form has acceptance evidence, not that
all Smarty variants are covered. `Partial` means only the described forms work.
`Ready` means a brief is available; it does not mean implementation has started.

| Feature | Status and supported boundary | Evidence / next task |
| --- | --- | --- |
| Text/output boundaries | Partial: ordinary text and expression output; no raw braces/auto-literal | [initial trees](../test/corpus/initial.txt) |
| Variables/numbers | Partial: simple variable names, unsigned decimal numbers | initial trees |
| Strings | Partial: simple quotes/escapes; no interpolation | initial trees, quoted-brace case |
| Arithmetic | Partial: binary `+ - * / %`, parentheses; no unary/boolean/comparison syntax | initial trees; precedence mutation; operator-field check |
| Generic tags | Partial: names, positional expressions, named attributes; no bare-word values | initial trees; [reference tests](../test/reference.test.mjs) |
| Custom closing tags | Supported as independent tags; pairing deliberately unspecified | initial mismatched-name case |
| Modifiers | Partial: chains and simple arguments; unrestricted names | initial trees; renamed-extension checks |
| If/elseif/else | Partial: nested blocks using supported expression forms | initial trees; [edit tests](../test/incremental.test.mjs) |
| Config variables | Partial: static ASCII names in expressions; no dynamic names/indexing | [001](tasks/001-config-variables.md) |
| Smarty comments | Ready: delimited comments first | [002](tasks/002-comments.md) |
| Object properties | Ready: static `->name` chains first | [003](tasks/003-object-properties.md) |
| Method/function calls | Unimplemented; next after property shape is established | Separate brief needed; corpus uses calls heavily |
| Dot/index access, arrays | Unimplemented | Separate briefs needed |
| Comparison/boolean/unary operators | Unimplemented | Specify precedence with additional Smarty evidence |
| Other built-in blocks | Unimplemented structurally; some names parse as generic tags | `foreach`, inheritance, capture, etc. need explicit contracts |
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

Implement 001, 002, then 003 as separate changes. These are ready specifications,
not permission to expand their scope into calls, interpolation, or literal blocks.

## Config variables evidence (2026-09-22)

Task 001 passes `npm test`: 15 trees, 27 Node checks, 3 mutation checks.
Identical hashes across 467 local files: **6 → 13 clean**, **461 → 454 failing**,
with no clean-to-failing regressions. See [001](tasks/001-config-variables.md).
