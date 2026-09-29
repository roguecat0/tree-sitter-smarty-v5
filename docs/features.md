# Feature inventory

The goal is a broadly useful Smarty 5 parser. Editor support is the primary use
case, and the same syntax trees should support CLI tools and other integrations.
Useful structure and recovery while users type matter especially for editors.
This inventory describes current evidence and gaps; it does not define the
intended final coverage ceiling. Work proceeds in bounded, reviewed changes.
Project-specific plugins and arbitrary custom tag semantics remain out of scope,
while unknown tags should preserve supported structure and expressions.

`Supported` means the explicitly bounded form has acceptance evidence, not that
all Smarty variants are covered. `Partial` means only the described forms work.
`Ready` means a brief is available; it does not mean implementation has started.

| Feature | Status and supported boundary | Evidence / next task |
| --- | --- | --- |
| Text/output boundaries | Partial: ordinary text and expression output; no raw braces/auto-literal | [initial trees](../test/corpus/initial.txt) |
| Variables/numbers | Partial: simple variable names, unsigned decimal numbers | initial trees |
| Strings | Partial: simple quotes/escapes; no interpolation (see [quoted-comment limitation](tasks/002-comments.md#reference-boundary-clarification)) | initial trees, quoted-brace case |
| Arithmetic | Partial: binary `+ - * / %`, parentheses and prefix `+ -`; see operator row | initial trees; precedence mutation; operator-field check |
| Generic tags | Partial: names, positional expressions, named attributes; no bare-word values | initial trees; [reference tests](../test/reference.test.mjs) |
| Custom closing tags | Supported as independent tags; pairing deliberately unspecified | initial mismatched-name case |
| Modifiers | Partial: chains and simple arguments; unrestricted names | initial trees; renamed-extension checks |
| If/elseif/else | Partial: nested blocks using supported expression forms | initial trees; [edit tests](../test/incremental.test.mjs) |
| Config variables | Partial: static ASCII names in expressions; bounded read indices; no dynamic names | [001](tasks/001-config-variables.md) |
| Smarty comments | Supported: `{* ... *}` through first terminator; non-nesting | [002](tasks/002-comments.md) |
| Object properties | Partial: static ASCII `->name` chains from variables/calls; no dynamic members | [003](tasks/003-object-properties.md) |
| Object method calls | Partial: static names, ordinary arguments, property/call chains | [004](tasks/004-object-method-calls.md) |
| Standalone function calls | Unimplemented; excluded from 004 | Separate brief needed |
| Dot/index read access | Partial: static dot keys and bounded bracket-index chains | [007](tasks/007-index-access.md) |
| Boolean/null literals | Supported: case-insensitive literals; bare section indices excluded | [008](tasks/008-primitive-literals.md) |
| Static class constants | Partial: adjacent static `Class::NAME` expressions | [009](tasks/009-class-constants.md) |
| Array literals | Unimplemented | Separate brief needed |
| Comparison/boolean/unary operators | Partial: symbolic comparisons, `&&`/`\|\|`, prefix `! + -`; no word aliases | [005](tasks/005-condition-operators.md) |
| Foreach blocks | Partial: modern `as` headers, optional key and `foreachelse` | [006](tasks/006-foreach-blocks.md) |
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
favor small independent changes because that improves confidence in each tree and
recovery behavior; it does not limit the project's eventual scope. Corpus counts
help prioritize common forms, while explicit syntax trees and malformed-input
checks establish whether the parser understood them usefully for downstream tools.

Tasks 001–009 are complete as separate verified changes within their bounded
scopes. Their corpus hints overlap and do not predict clean-file gains.
Standalone functions, array literals, interpolation, bitwise/word operators and
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

## Object method evidence (2026-09-22)

Task [004](tasks/004-object-method-calls.md) passes `npm test`: 43 trees,
68 Node checks, six mutations. Hash-matched local corpus: **15 → 27 clean**,
**452 → 440 failing**, no regressions. Explicit call fields were inspected in
all 12 newly clean files.

## Condition operator evidence (2026-09-23)

Task [005](tasks/005-condition-operators.md) passes `npm test`: 67 trees,
98 Node checks, seven mutations. Hash-matched local corpus: **27 → 30 clean**,
**440 → 437 failing**, no regressions. All three newly clean files contain
explicit operator fields. Full-engine checks supplement the narrower recorder
for precedence and PHP comparison-chain rejection.

## Foreach evidence (2026-09-23)

Task [006](tasks/006-foreach-blocks.md) passes `npm test`: 75 trees, 111 Node
checks, eight mutations. Hash-matched local corpus: **30 → 46 clean**,
**437 → 421 failing**, no regressions. The 16 newly clean files contain 19
explicit loops whose header fields, branch ownership and closers were reviewed.
Across tasks 004–006 the result is **15 → 46 clean**, **452 → 421 failing**;
this is still triage evidence rather than a language-coverage percentage.

## Index access evidence (2026-09-23)

Task [007](tasks/007-index-access.md) passes `npm test`: 84 trees, 124 Node
checks, nine mutations. Hash-matched local corpus: **46 → 57 clean**, **421 →
410 failing**, no regressions. All eleven newly clean files retain explicit
object/index fields (60 index nodes). Remaining failures are reported separately
from supported syntax; no runtime `$smarty` behavior is claimed.

## Primitive literal evidence (2026-09-29)

Task [008](tasks/008-primitive-literals.md) passes `npm test`: 91 trees,
137 Node checks and nine mutations. All 467 corpus hashes match: **57 → 71 clean**,
**410 → 396 failing**, no regressions. Fourteen newly clean files have explicit
literal nodes. Bare bracket primitive names are section syntax in Smarty;
parenthesized/compound indices are supported expressions.

## Class constant evidence (2026-09-29)

Task [009](tasks/009-class-constants.md) passes `npm test`: 100 trees,
151 Node checks and ten mutations. All 467 corpus hashes match: **71 → 98 clean**,
**396 → 369 failing**, no regressions. The 27 newly clean files contain 145
explicit constant nodes whose class/member fields were inspected. Clean parses
do not establish runtime class existence or complete language coverage.
