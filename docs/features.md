# Feature inventory

The goal is a broadly useful Smarty 5 parser. Editor support is the primary use
case, and the same syntax trees should support CLI tools and other integrations.
Useful structure and recovery while users type matter especially for editors.
This inventory describes current evidence and gaps; it does not define the
intended final coverage ceiling. Work proceeds in bounded, reviewed changes.
The local application corpus is the real-world completeness signal for this
use case: remaining parse errors expose gaps to investigate and add to this
inventory/task queue. The inventory must grow or its boundaries be corrected
when corpus failures reveal unsupported practical syntax.
Project completion requires zero parse errors in the fixed local application
corpus, plus structural review of newly clean files; this inventory is a living
map toward that result, not a substitute for it.
The ignored application files live under `corpus/application/`. Upstream Smarty
test fixtures live separately under `corpus/upstream-smarty-v5.8.4-core/`, and
the official demo lives under `corpus/upstream-smarty-v5.8.4-example/`. The
default reporter reads only the application root; upstream roots are optional
evidence and must be reported separately.
Project-specific plugins and arbitrary custom tag semantics remain out of scope,
while unknown tags should preserve supported structure and expressions.

`Supported` means the explicitly bounded form has acceptance evidence, not that
all Smarty variants are covered. `Partial` means only the described forms work.
`Ready` means a brief is available; it does not mean implementation has started.

| Feature | Status and supported boundary | Evidence / next task |
| --- | --- | --- |
| Text/output boundaries | Partial: ordinary text, expression output and default `auto_literal` brace boundaries; structured Smarty output attributes remain unsupported (including trailing attributes on function outputs; valid gap deferred in 011) | [initial trees](../test/corpus/initial.txt); [default boundary trees](../test/corpus/smarty-reference.txt); [014](tasks/014-default-auto-literal-boundary.md); [011](tasks/011-standalone-function-calls.md) |
| Variables/numbers | Partial: simple variable names, unsigned decimal numbers | initial trees |
| Strings | Partial: supported quoted literals and the reviewed Task 020 forms—direct, braced, and immediate-backtick-dollar interpolation in double-quoted strings; dollars not followed by Smarty ID remain literal (including digit suffixes); non-expression backticks remain string text. Digit-prefixed variables are supported only inside interpolated strings; unquoted `{$5a}` remains unsupported. Composition is reviewed only in output, generic-tag attribute, and modifier-argument positions | [manual interpolation trees and checks](../test/corpus/interpolated-strings.txt); [020 corpus evidence](tasks/020-double-quoted-interpolation.md) |
| Arithmetic | Partial: binary `+ - * / %`, parentheses and prefix `+ -`; see operator row | initial trees; precedence mutation; operator-field check |
| Generic tags | Partial: unrestricted Smarty ID names (including digit-prefixed `123foo`), positional expressions, named attributes, and direct static ID values in positional/attribute positions. Attribute names preserve hyphens, digit prefixes, and multi-segment single-colon names such as `foo:bar:baz` in a local `tag_attribute_name` leaf. Terminal-colon `foo:=MODE` and repeated-colon `foo::bar=MODE` are Smarty-valid explicit gaps with error/recovery coverage. Plugin semantics remain out of scope | [initial trees](../test/corpus/initial.txt); [static ID trees and checks](../test/corpus/generic-tag-identifier-values.txt); [attribute-name trees/checks](../test/corpus/tag-attribute-names.txt); [018](tasks/018-generic-tag-identifier-values.md); [023 revised scope and evidence](tasks/023-smarty-tag-attribute-names.md#partial-boundary-revision-2026-10-01) |
| Custom closing tags | Supported as independent tags; pairing deliberately unspecified | initial mismatched-name case |
| Modifiers | Partial: chains and supported expression arguments, including direct loop metadata and one static `ID` token after a modifier colon; Task 022 also adds bare IDs as tested output/condition primaries, function/method arguments, and array-element values. Other expression-context pairings remain unverified. | initial trees; renamed-extension checks; [016 loop-metadata modifier argument trees and checks](tasks/016-loop-metadata-modifier-argument.md); [017 trees and checks](tasks/017-static-modifier-arguments.md); [018 generic-tag values](tasks/018-generic-tag-identifier-values.md); [022 trees/checks/evidence](tasks/022-static-identifier-expressions.md) |
| Bare static identifier values | Partial: direct `ID` tokens are supported as generic-tag positional/attribute values, modifier arguments, array keys, and primary expressions in tested outputs, conditions, function/method arguments, and array-element values. Foreach sources, modifier inputs, bracket indices and other untested pairings remain unverified. | [017 modifier trees](tasks/017-static-modifier-arguments.md); [018 generic-tag trees](tasks/018-generic-tag-identifier-values.md); [array key tree](../test/corpus/array-literals.txt); [022 trees/checks/evidence](tasks/022-static-identifier-expressions.md) |
| If/elseif/else | Partial: nested blocks using supported expression forms | initial trees; [edit tests](../test/incremental.test.mjs) |
| Config variables | Partial: static ASCII names in expressions; bounded read indices; no dynamic names | [001](tasks/001-config-variables.md) |
| Smarty comments | Supported: `{* ... *}` through first terminator; non-nesting | [002](tasks/002-comments.md) |
| Object properties | Partial: static ASCII `->name` chains from variables/calls; no dynamic members | [003](tasks/003-object-properties.md) |
| Object method calls | Partial: static names, ordinary arguments, property/call chains | [004](tasks/004-object-method-calls.md) |
| Standalone function calls | Partial: unqualified static identifier calls with ordinary expression arguments; namespaced, dynamic, and `::` callees, result chains, and trailing function-output attributes remain gaps | [call trees](../test/corpus/standalone-function-calls.txt); [011](tasks/011-standalone-function-calls.md) |
| Dot/index read access | Partial: static dot keys and bounded bracket-index chains | [007](tasks/007-index-access.md) |
| Boolean/null literals | Supported: case-insensitive literals; bare section indices excluded | [008](tasks/008-primitive-literals.md) |
| Static class constants | Partial: adjacent static `Class::NAME` expressions | [009](tasks/009-class-constants.md) |
| Static class method calls | Partial: unqualified `Class::method(...)` calls with ordinary arguments are primary expressions across the audited contexts; control-word and primitive class names are retained as identifiers, while `self`/`parent`, method-result chains, namespace-qualified and dynamic receivers remain excluded | [trees and composition checks](../test/corpus/static-class-method-calls.txt); [019](tasks/019-static-class-method-calls.md) |
| Array literals | Partial: `[...]` and `array(...)`, keyed/list values, nesting and trailing commas | [010](tasks/010-array-literals.md) |
| Comparison/boolean/unary operators | Partial: symbolic comparisons, `&&`/`\|\|`, prefix `! + -`, exact `is div by` predicate, and binary bitwise `&` as a shared-expression operator; other Smarty math operators `**`, `^`, `<<`, `>>`, word aliases, and other `is ...` predicates remain unsupported | [005](tasks/005-condition-operators.md); [013](tasks/013-divisibility-predicate.md); [bitwise trees/checks](../test/corpus/bitwise-and.txt); [021 complete](tasks/021-bitwise-and.md) |
| Foreach blocks | Partial: modern `as` headers, optional key and `foreachelse`; static item metadata suffixes parse as expressions, including direct modifier arguments. Legacy headers and runtime binding/metadata validation remain out of scope | [006](tasks/006-foreach-blocks.md); [012](tasks/012-loop-metadata.md); [016 trees and checks](tasks/016-loop-metadata-modifier-argument.md) |
| Other built-in blocks | Unimplemented structurally; some names parse as generic tags | Inheritance, capture, etc. need explicit contracts |
| Literal blocks/auto-literal | Partial: default `{`/`}` boundaries follow `auto_literal=true`, including whitespace after `{`, `{}`, and raw right braces; `{literal}` regions and non-default delimiter/configuration behavior remain gaps | [014 trees and checks](tasks/014-default-auto-literal-boundary.md) |
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
that our generic rules accept without understanding inheritance. Conversely,
the 461 failing files are not merely a prioritization metric: their remaining
parse errors must be investigated and converted into feature/task work for this
application. The first briefs favor small independent changes because that
improves confidence in each tree and recovery behavior; it does not limit the
project's eventual scope. Corpus hints overlap and are not diagnoses. Explicit
syntax trees and malformed-input checks establish whether supported syntax is
understood usefully, while corpus errors show where practical coverage is still
missing.

Tasks 001–010 are complete as separate verified changes within their bounded
scopes. Their corpus hints overlap and do not predict clean-file gains; remaining
corpus failures still need to drive further inventory and task updates.
Task 011 passes its implementation gate for ordinary standalone calls; its
independent review is pending. The remaining namespace/dynamic/result-chain and
trailing output-attribute gaps stay visible in the feature rows. Interpolation,
bitwise/word operators, literal blocks, and other unimplemented inventory rows
still need briefs or scope decisions.

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

## Array literal implementation evidence (2026-09-30)

Task [010](tasks/010-array-literals.md) adds short and `array(...)` literals as
primary expressions, with explicit `array_element` children and `key`/`value`
fields. Its hand-written trees cover empty, list, keyed, nested and trailing
comma forms, parenthesized compound keys, unknown tags, modifiers, index values,
conditions, and `if`/`foreach` composition. Reference checks confirm the exposed
output/tag events; the recorder does not inspect array entry values. `npm test`
passes 108 corpus trees, 152 Node checks, and the existing ten mutation checks.

The baseline audit (`grammarSha256`
`a6a8d1263dd532a54c8e8b15da42ad46bc73df8ceed82fbe16049518a308afe7`) measured
467 files: 98 clean and 369 failing. The after report (`grammarSha256`
`0304cbe4b50d712ce545362f5679fcd1ebb3e78648dadb667589a5c8a82e5f64`) has the
same 467 source hashes: 99 clean and 368 failing, with no regressions. The newly
clean `view_sap/article_details.tpl` contains an explicit `array_literal` with
two `array_element` nodes holding method calls; its node structure was inspected.
At the end of task 010, 368 files still contained unresolved parser errors;
task 011's report and remaining count follow below.

## Array literal corpus motivation (baseline, 2026-09-30)

The baseline hash-matched audit found parse errors whose snippets contain
`get_url([` in 53 distinct failing templates (770 reported error entries,
including overlapping nodes). `view_wage_work/wage_work_repairs_params.tpl:30`
contains a keyed query array passed to `get_url`; the reduced
`{$user->find(["id"=>1, "active"=>true])}` is accepted by the Smarty 5.8.4
recording compiler and produces an output event, while the baseline parser
reports errors. See [task 010](tasks/010-array-literals.md). The recorder checks
only the output event, so keyed/list entry structure and value binding require
manual expected trees.

## Standalone function evidence (2026-09-30)

Task [011](tasks/011-standalone-function-calls.md) passes `npm test` with 118
corpus trees, 168 Node checks and all 11 mutation checks caught. Hash-matched reports
`/tmp/smarty-array-after.json` and `/tmp/smarty-011-final-after.json` preserve all 467
source hashes and show **99 → 135 clean**, **368 → 332 failing**, with no
regressions. All 36 newly clean files were inspected for explicit function-call
names and argument node fields; the review is saved in
`/tmp/smarty-011-review.json`. Smarty 5.8.4 confirms tag-shaped
`{widget ($a > 0)}` is function output, correcting the 005 generic-tag
expectation. The full function-output-with-attributes form remains a recorded
valid Smarty gap with parser error recovery. Independent task review is pending.

Other unresolved clusters remain visible: standalone function calls in
conditions/arguments (`is_valid_id(...)`, `date(...)`) are covered by the
ordinary-call subset in [011](tasks/011-standalone-function-calls.md); remaining
call gaps are named in that task. The corpus-confirmed `is div by` predicate is
described in [013](tasks/013-divisibility-predicate.md). Bitwise expressions,
literal blocks, other built-in blocks, and other word predicates/operators still
need separate source classification and minimized Smarty observations.

## Default brace boundary evidence (2026-10-01)

Task [014](tasks/014-default-auto-literal-boundary.md) passes `npm test` with
133 corpus trees, 194 Node checks, and all 11 mutation checks caught. With
identical source hashes across 467 application templates, the corpus report
improved from **142 clean / 325 failing** to **186 clean / 281 failing**, with
no regressions. All 44 newly clean trees were inspected; each contains
structured Smarty nodes rather than only text. Default `{`/`}` auto-literal
behavior is now supported within the stated contract; `{literal}` blocks and
the remaining 281 corpus failures still need later work. See the task brief for
the full new-file list and saved report locations.

## Divisibility predicate evidence (2026-10-01)

Task [013](tasks/013-divisibility-predicate.md) adds the exact `is div by`
operator to the shared expression ladder. It produces `binary_expression` with
`left`, named `div_by_operator`, and `right` fields in outputs, conditions,
parenthesized modifier arguments, and other existing full-expression positions.
The right operand is a supported value, including unary and parenthesized
forms. Other `tlop` variants and direct unparenthesized modifier arguments
remain gaps. Hand-written trees cover metadata and call operands, relational
and arithmetic grouping, unary RHS, boolean composition, output expressions,
and parenthesized modifier arguments. Smarty reference checks compare only
observable events; fixed full-engine cases independently verify controlled
rendering and PHP translation behavior.

`npm test` passes 142 corpus trees, 211 Node checks, and all 11 mutation
checks. Hash-matched corpus reports `/tmp/smarty-013-before-v2.json` and
`/tmp/smarty-013-after.json` contain the same 467 source hashes and show
**186 → 240 clean**, **281 → 227 failing**, with no regressions. All 54 newly
clean files were structurally inspected: they contain 63 `div_by_operator`
nodes with explicit binary left/right fields and supported operand nodes. No
existing expectation changed. The final parser hash is
`829aa943ed57457b277c998f2e6478d4029e147282c925442e7df5dae08574b6`; remaining
227 errors continue to represent unresolved corpus gaps.

## Optional upstream Smarty source corpus (Task 024, 2026-10-01)

The tracked manifest at `test/upstream-smarty-v5.8.4/manifest.json` selects 33
positive `.tpl` fixtures across 11 families from Smarty v5.8.4 commit
`94a27cbbc7820198d7adc17a2be8d457fb267753`; one official demo template is
materialized and reported separately. Provenance includes source/test Git
blobs and SHA-256 hashes. All 33 positive sources passed the local Smarty
5.8.4 recording compiler, and the selected upstream PHPUnit commands passed
46 tests with 56 assertions. See Task 024 for the exact commands and evidence.

This auxiliary corpus currently parses as 19 clean / 14 with errors under the
local grammar. The separately reported demo parses as 0 clean / 1 with errors.
The report is not combined with or substituted for the fixed 467-file
application corpus (449 clean / 18 with errors at the same parser snapshot).
The 19 clean trees were inspected: structured comment, string, foreach, and if
nodes occur in some files, while other built-in constructs remain preserved
as generic tags. A clean parse therefore does not claim structural support for
those constructs. Upstream reports are optional syntax evidence and do not
establish plugin execution, runtime values, cache behavior, block validation,
or full grammar coverage. The demo is contextual and is not positive compiler
evidence. Materialization requires a caller-provided pinned checkout, performs
no network access, and writes only into ignored directories; CI has no upstream
checkout dependency. See `test/upstream-smarty-v5.8.4/NOTICE.md` for attribution.
