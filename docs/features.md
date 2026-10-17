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
| Text/output boundaries | Partial: ordinary text, expression output and default `auto_literal` brace boundaries; supported expression outputs own ordered direct `attribute` children for bare/valued/repeated case-insensitive trailing `nocache`, including symbolic and word comparison/boolean expressions, bitwise `&`, and `is div by`. The suffix keeps the output expression in `output.value` and preserves the suffix name/value ranges. `{widget nocache}` remains a generic tag. `assign`, `nofilter`, arbitrary output attributes, and compiler/runtime effects remain gaps | [initial trees](../test/corpus/initial.txt); [default boundary trees](../test/corpus/smarty-reference.txt); [nocache trees](../test/corpus/output-nocache-attribute.txt); [reference/compiler/recovery/edit checks](../test/output-nocache-attribute.test.mjs); [014](tasks/014-default-auto-literal-boundary.md); [011](tasks/011-standalone-function-calls.md); [042 evidence](tasks/042-output-nocache-attribute.md#implementation-and-corpus-evidence); Ready: [050 nofilter](tasks/050-output-nofilter.md) |
| Shorthand assignment tags | Partial: short assignment tags produce `assignment_tag` with structured direct-variable or supported nonempty-index targets, full expression values, and only compiler-confirmed bare or valued `nocache` options. Arbitrary trailing attributes are rejected. Empty append and bare identifier section-index targets remain standard syntax gaps; ordinary `{assign}` stays a generic tag and plugin/runtime assignment semantics are not inferred | [033 trees, reference/full-engine/recovery/edit checks, and separate corpus evidence](tasks/033-shorthand-assignment-tags.md) |
| Variables/numbers | Partial: simple variable names, unsigned decimal numbers | initial trees |
| Strings | Partial: supported quoted literals and the reviewed Task 020 forms—direct, braced, and immediate-backtick-dollar interpolation in double-quoted strings; dollars not followed by Smarty ID remain literal (including digit suffixes); non-expression backticks remain string text. Digit-prefixed variables are supported only inside interpolated strings; unquoted `{$5a}` remains unsupported. Task 047 adds recognized tags and `if` blocks inside double-quoted strings in reviewed output, named/positional generic-tag values, function/method arguments, and modifier-input contexts. `{literal}` markers remain fragments; comment openers in quoted values are syntax errors. Other block families and compositions remain unverified | [manual interpolation trees and checks](../test/corpus/interpolated-strings.txt); [020 corpus evidence](tasks/020-double-quoted-interpolation.md); [047 trees, compiler/reference/recovery/edit checks](tasks/047-tags-in-quoted-attributes.md#implementation-evidence-2026-10-17) |
| Arithmetic | Partial: binary `+ - * / %`, parentheses and prefix `+ -`; see operator row | initial trees; precedence mutation; operator-field check |
| Typecast expressions | Partial: Smarty 5.8.4's eleven case-insensitive `TYPECAST value` spellings produce `typecast_expression` with `operator` and `argument` fields. Independently reviewed in output, `if`/`elseif`, generic-tag positional/named values, built-in assignment attributes, instance-method arguments, modifier input/argument, bracket indices, and array keys/values. Other context pairings remain unverified; `real` is parser/compiler syntax but Smarty reports that the cast has been removed at runtime. | [Task 040's cast-key observation](tasks/040-unary-array-literal-keys.md); [Task 041 trees, checks, corpus evidence, and review](tasks/041-typecast-expressions.md) |
| Generic tags | Partial: unrestricted Smarty ID names (including digit-prefixed `123foo`), positional expressions, named attributes, and direct static ID values in positional/attribute positions. Braced expressions in named attribute values are supported as `attribute.value: output(value: expression)` for tested variables, arithmetic, strings, dynamic-dot and method-index values; direct values remain unwrapped. Attribute names preserve hyphens, digit prefixes, multi-segment single-colon names such as `foo:bar:baz` in a local `tag_attribute_name` leaf, and contextual reserved words (`parent`, `self`, and control words) as exact-spelling `identifier` leaves in the attribute-name field. Terminal-colon `foo:=MODE` and repeated-colon `foo::bar=MODE` remain separate Smarty-valid parser gaps with error/recovery coverage. Task 040 adds unary array keys in generic-tag attribute expressions, including the corpus `html_options` addition; plugin semantics remain out of scope | [initial trees](../test/corpus/initial.txt); [Task 037 trees/reference/recovery/edit checks and corpus evidence](tasks/037-braced-generic-tag-attribute-values.md); [Task 040 array trees](../test/corpus/array-literals.txt); [Task 040 reference/recovery/edit checks and corpus evidence](tasks/040-unary-array-literal-keys.md); [static ID trees and checks](../test/corpus/generic-tag-identifier-values.txt); [attribute-name trees/checks](../test/corpus/tag-attribute-names.txt); [contextual-name trees/checks](../test/corpus/contextual-attribute-names.txt); [018](tasks/018-generic-tag-identifier-values.md); [023 revised scope and evidence](tasks/023-smarty-tag-attribute-names.md#partial-boundary-revision-2026-10-01); [025 evidence](tasks/025-contextual-attribute-names.md) |
| Custom closing tags | Supported as independent tags; pairing deliberately unspecified | initial mismatched-name case |
| Modifiers | Partial: chains and supported expression arguments, including direct loop metadata and one static `ID` token after a modifier colon; Task 022 also adds bare IDs as tested output/condition primaries, function/method arguments, and array-element values. Adjacent `|@name` and `|@@name` prefixes preserve the modifier-name field in outputs; `|@name` is also tested in generic-tag named attribute values. The application corpus's four `|@ucfirst` sites now parse structurally. Modifier/runtime resolution remains out of parser scope, and prefixed forms in other expression contexts remain unverified. | initial trees; renamed-extension checks; [016 loop-metadata modifier argument trees and checks](tasks/016-loop-metadata-modifier-argument.md); [017 trees and checks](tasks/017-static-modifier-arguments.md); [018 generic-tag values](tasks/018-generic-tag-identifier-values.md); [022 trees/checks/evidence](tasks/022-static-identifier-expressions.md); [036 modifier-prefix trees, checks, and corpus evidence](tasks/036-modifier-at-prefix.md); Ready: [049 braced arguments](tasks/049-braced-modifier-arguments.md) |
| Bare static identifier values | Partial: direct `ID` tokens are supported as generic-tag positional/attribute values, modifier arguments, array keys, and primary expressions in tested outputs, conditions, function/method arguments, and array-element values. Foreach sources, modifier inputs, bracket indices and other untested pairings remain unverified. | [017 modifier trees](tasks/017-static-modifier-arguments.md); [018 generic-tag trees](tasks/018-generic-tag-identifier-values.md); [array key tree](../test/corpus/array-literals.txt); [022 trees/checks/evidence](tasks/022-static-identifier-expressions.md) |
| If/elseif/else | Partial: nested blocks using the supported condition expressions. Both `{elseif ...}` and exact lowercase one-space `{else if ...}` use `elseif_clause` / `elseif_tag(condition: expression)`, preserving header ranges, branch order, and body ownership; other spacing/case is not normalized. A braced expression is supported as one primary operand in `{if}` and `{elseif}` conditions: `condition` owns the existing expression tree, with a nested `output(value: expression)` at the wrapped operand; direct conditions stay unwrapped, and inside/outside operators keep existing precedence and fields. Tested recovery retains the left wrapper plus a localized missing-operator error, recognizes missing-header close recovery, and preserves a separate trailing output; an unmatched crossed close may remain under a root `ERROR` without a completed `if_block`. Broader Smarty conditional syntax remains partial | initial trees; [edit tests](../test/incremental.test.mjs); [Task 038 investigation](tasks/038-braced-expressions-in-bracket-indices.md); [Task 039 trees, reference/compiler, recovery and edit checks](../test/corpus/braced-conditions.txt); [Task 039 brief and corpus evidence](tasks/039-braced-expressions-in-conditions.md); [Task 046 trees and checks](../test/corpus/else-if-branches.txt); [Task 046 accepted implementation evidence](tasks/046-else-if-branches.md#implementation-evidence) |
| Config variables | Partial: static ASCII names in expressions; bounded read indices; no dynamic names | [001](tasks/001-config-variables.md) |
| Smarty comments | Supported: `{* ... *}` through first terminator; non-nesting | [002](tasks/002-comments.md) |
| Object properties | Partial: static ASCII `->name` chains from variables/calls; no dynamic members | [003](tasks/003-object-properties.md) |
| Object method calls | Partial: static names, ordinary arguments, property/call chains | [004](tasks/004-object-method-calls.md) |
| Standalone function calls | Partial: unqualified static identifier calls with ordinary expression arguments; namespaced, dynamic, and `::` callees and result chains remain gaps. Trailing function-output `nocache` is covered by the shared output feature in Task 042; other function-output attributes remain gaps | [call trees](../test/corpus/standalone-function-calls.txt); [011](tasks/011-standalone-function-calls.md); [042](tasks/042-output-nocache-attribute.md) |
| Dot/index read access | Partial: static dot keys, dynamic `.{$expr}` indices with full expression structure, ordinary bracket indices, and bounded left-nested chains. Braced Smarty expressions inside bracket indices (`$rows[{$index}]`) preserve the complete expression under a nested `output` in `index`, including repeated indices, outer bracket spacing, and tested output/generic-tag attribute composition. Smarty-accepted empty append indices (`$rows[]`) and bare identifier bracket keys (`$rows[key]`) remain separate standard syntax gaps in reads and assignment targets | [007](tasks/007-index-access.md); [035 trees, reference/recovery/edit checks, and corpus evidence](tasks/035-dynamic-dot-index.md); [037 braced attribute values](tasks/037-braced-generic-tag-attribute-values.md); [038 trees, references, recovery/edit checks, and corpus evidence](tasks/038-braced-expressions-in-bracket-indices.md) |
| Boolean/null literals | Supported: case-insensitive literals; bare section indices excluded | [008](tasks/008-primitive-literals.md) |
| Static class constants | Partial: adjacent static `Class::NAME` expressions | [009](tasks/009-class-constants.md) |
| Static class method calls | Partial: unqualified and namespace-qualified `Class::method(...)` calls with ordinary arguments are primary expressions across the audited contexts; qualified receivers preserve segments in `qualified_name`, including rooted one-segment names, contextual words, and Smarty's locally scoped digit-prefixed namespace IDs. Unqualified `self`/`parent`, method-result chains, and dynamic receivers remain excluded; namespaced constants remain a separate gap | [unqualified trees](../test/corpus/static-class-method-calls.txt); [qualified trees and checks](../test/corpus/namespaced-static-method-calls.txt); [019](tasks/019-static-class-method-calls.md); [048 accepted implementation evidence](tasks/048-namespaced-static-method-calls.md#implementation-evidence) |
| Array literals | Partial: `[...]` and `array(...)`, keyed/list values, nesting, trailing commas, supported unary keys with their `unary_expression` fields, and typecast keys/values with `typecast_expression` fields. Unparenthesized binary keys remain rejected; parenthesized compound keys are supported | [010](tasks/010-array-literals.md); [Task 040 trees/checks and corpus evidence](tasks/040-unary-array-literal-keys.md); [Task 041 trees/checks/review and corpus evidence](tasks/041-typecast-expressions.md#implementation-evidence-2026-10-04) |
| Conditional ternary expressions | Ready: full three-operand `condition ? consequent : alternative`; currently an error in the current HDB template audit. Precedence and association require pinned compiler evidence before implementation; shorthand `?:` remains separate | [051](tasks/051-ternary-expressions.md) |
| Comparison/boolean/unary operators | Partial: symbolic comparisons, `&&`/`\|\|`, case-insensitive word aliases `and`/`or`/`xor` and comparison aliases `eq`/`ne`/`neq`/`gt`/`ge`/`gte`/`lt`/`le`/`lte`, with exact `word_operator` ranges, required two-sided whitespace, and Smarty precedence; prefix `! + -` and word `not`; exact `is div by`, binary `is [not] odd/even by` grouping predicates, and postfix unary `is [not] odd/even` predicates; and binary bitwise `&` as a shared-expression operator. Unary parity predicates use `single_condition_expression(left, operator: single_condition_operator)` and compose with the observed precedence. The pinned compiler accepts tabs/newlines in the `SINGLECOND` token but its semantic mapping strips ordinary spaces only and emits invalid generated PHP for those separators; runtime coverage is limited accordingly. Word arithmetic alias `mod`, other Smarty math operators `**`, `^`, `<<`, `>>`, `is not div by`, and other `is ...` predicates remain standard syntax gaps. The upstream demo parity-grouping gap is covered by Task [043 implementation evidence](tasks/043-parity-grouping-predicates.md#implementation-and-corpus-evidence-2026-10-04); unary forms are covered by [Task 044 implementation evidence](tasks/044-unary-parity-predicates.md#implementation-and-corpus-evidence). | [005](tasks/005-condition-operators.md); [013](tasks/013-divisibility-predicate.md); [bitwise trees/checks](../test/corpus/bitwise-and.txt); [021 complete](tasks/021-bitwise-and.md); [031 prefix `not` implementation evidence](tasks/031-word-boolean-operators.md); [032 trees/checks](../test/corpus/word-binary-boolean-operators.txt), [implementation evidence](tasks/032-word-binary-boolean-operators.md); [034 trees/checks and corpus evidence](tasks/034-word-comparison-operators.md); [043 trees/checks](../test/corpus/parity-grouping-predicates.txt); [044 trees/checks](../test/corpus/unary-parity-predicates.txt), [implementation evidence](tasks/044-unary-parity-predicates.md#implementation-and-corpus-evidence) |
| Foreach blocks | Partial: modern `as` headers with optional key and legacy named/positional headers preserve their fields and source order; modern headers also retain trailing `name`, `key`, `properties`, and redundant `from`/`item` attributes after synthesized binding fields. Bare `nocache` is a `foreach_option`; valued `nocache` is an `attribute` in modern and legacy headers, with `true/false/1/0` accepted quoted or unquoted and whitespace around `=` preserved. Empty legacy lists remain parser syntax, while required attributes, option values, positional value types, and runtime loop/cache behavior follow separate compiler/runtime boundaries. Modern and legacy loops structurally own `foreachelse`. The designer prose denying modern named attributes conflicts with the pinned parser/compiler observation; see [028](tasks/028-foreach-header-options.md). Static item metadata suffixes parse as expressions, including direct modifier arguments; runtime binding, iteration and metadata evaluation remain outside the tree contract | [modern trees/checks](../test/corpus/foreach.txt); [legacy trees/checks](../test/corpus/legacy-foreach.txt); [Task 028 trees/checks](../test/corpus/foreach-header-options.txt); [reference/compiler/recovery/edit checks](../test/legacy-foreach.test.mjs); [Task 028 checks](../test/foreach-header-options.test.mjs); [006](tasks/006-foreach-blocks.md); [012](tasks/012-loop-metadata.md); [016 trees and checks](tasks/016-loop-metadata-modifier-argument.md); [027 evidence](tasks/027-legacy-foreach.md); [028 evidence](tasks/028-foreach-header-options.md) |
| For loops | Partial: standard range and C-style headers, indexed targets, range `step`/`max`, `nocache`, syntactic trailing options, `{forelse}`, and nested `{for}`/`foreach`/`if` ownership. An omitted C-style condition produces an error marker while retaining the loop, closer, and later siblings; an omitted update still has the separately tested top-level `ERROR` recovery shape. Full runtime loop semantics remain outside the tree contract | [hand-authored trees](../test/corpus/for-loops.txt); [reference/compiler/recovery/edit checks](../test/for-loops.test.mjs); [026 evidence](tasks/026-for-loops.md); [031 omitted-condition recovery evidence](tasks/031-word-boolean-operators.md#completed-implementation-and-evidence) |
| Other built-in blocks | Partial: `{section}` blocks own nested bodies, `{sectionelse}`, and their matching close; long and short headers retain required fields and standard options; `[sectionName]`, `[sectionName.property]`, and `$smarty.section.name.property` remain explicit. Runtime iteration and values remain outside syntax trees; other built-in block families are still unimplemented structurally | [section trees](../test/corpus/section-blocks.txt), [Smarty-reference trees](../test/corpus/smarty-reference.txt), [reference/compiler/recovery/edit checks](../test/section-blocks.test.mjs), and [030 separate corpus evidence](tasks/030-section-blocks-and-indices.md); `{while}`, inheritance, capture, switch, and other built-in forms remain queued gaps |
| Literal blocks/auto-literal | Partial: default `{`/`}` boundaries follow `auto_literal=true`, including whitespace after `{`, `{}`, and raw right braces; default `{literal}` regions preserve opaque body bytes; alternate delimiters and `auto_literal=false` remain separate gaps | [014 trees and checks](tasks/014-default-auto-literal-boundary.md); [029 literal trees, reference and implementation evidence](tasks/029-literal-blocks.md) |
| Configurable delimiters | Unimplemented | Design decision needed |
| HTML injections/editor queries | Supported for existing syntax: Smarty highlights, combined HTML including literal bodies, recognized-block folds; nested JS/CSS retain Smarty highlighting through priority 110. Indentation and textobjects deferred. | [Task 045](tasks/045-editor-queries.md), [Neovim setup](neovim.md), [checks](../test/editor-queries.test.mjs) |
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
Task 011 passes its implementation gate for ordinary standalone calls; Task 042
also covers trailing function-output `nocache` and has passed independent
implementation review. Task 011's independent review remains pending.
Namespaced/dynamic/result-chain calls and output `assign`/`nofilter`/other
attribute gaps stay visible in the feature rows. Interpolation,
bitwise/word operators, and other unimplemented inventory rows still need briefs
or scope decisions.

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
other built-in blocks, and other word predicates/operators still need separate
source classification and minimized Smarty observations.

## Default brace boundary evidence (2026-10-01)

Task [014](tasks/014-default-auto-literal-boundary.md) passes `npm test` with
133 corpus trees, 194 Node checks, and all 11 mutation checks caught. With
identical source hashes across 467 application templates, the corpus report
improved from **142 clean / 325 failing** to **186 clean / 281 failing**, with
no regressions. All 44 newly clean trees were inspected; each contains
structured Smarty nodes rather than only text. Default `{`/`}` auto-literal
behavior is now supported within the stated contract. The remaining 281 corpus
failures still need later work. See the task brief for the full new-file list
and saved report locations.

## Literal block evidence (2026-10-02)

Task [029](tasks/029-literal-blocks.md) adds default-delimiter `{literal}`
regions with a case-insensitive opener/closer, exact raw body bytes, nested
marker preservation, empty bodies, and composition inside supported blocks.
Smarty-looking tags, outputs, comments, and CSS braces inside the region remain
one `literal_content` node. The application corpus stays at 456 clean / 11
failing files, but both CSS affected templates lose their earlier literal-body
parse error (three errors each become two). Their later `neq` and recovery
errors remain; there are no newly clean files or regressions. The separate
upstream core and demo reports are unchanged. `npm test` passes 252 Tree-sitter
corpus parses, 354 Node checks, and all 18 mutation checks. See Task 029 for
separate report hashes, source hashes, and the structurally inspected trees.

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

## Word comparison operator evidence (Task 034, 2026-10-03)

Task [034](tasks/034-word-comparison-operators.md) supports Smarty's nine
case-insensitive comparison aliases at the existing symbolic equality and
relational precedence levels. Exact token spelling/ranges and two-sided
whitespace are tested, along with expression-context composition, full-engine
operator mappings and precedence, malformed recovery, and incremental edits.
`npm test` passes 299 corpus trees, 427 Node checks, and all 18 mutation checks.

The reports are hash-matched to parser SHA-256
`1eb5a5ddf5dc7750fc8bf7a250f27fc695c34432baecd49bec08c3bcb119677d` and remain
separate: application **459 → 461 clean / 8 → 6 failing**, upstream core
**31 → 31 clean / 2 → 2 failing**, and upstream demo **0 → 0 clean / 1 → 1
failing**. Application source hashes match the baseline; the two newly clean
files, `view_stats/action_chart.tpl` and `view_stats/stats.tpl`, were inspected
and contain explicit `neq` comparison trees with operands and `if` closers.
There were no regressions in any root. Separate JSON reports are saved at
`/tmp/smarty-task034-final-application.json`,
`/tmp/smarty-task034-final-upstream-core.json`, and
`/tmp/smarty-task034-final-upstream-example.json`.

The malformed comparison contract records the observed error sibling under
`if_tag`; no missing RHS node is represented. Word arithmetic `mod`, other
math operators, and other `is ...` predicates remain syntax gaps. Independent
implementation review is pending; this task does not establish project
completion.

## Current FBS/HDB audit (2026-10-17)

A read-only scan of the current sibling application trees, after regenerating
and rebuilding the parser, measured the following independent roots:

| Root | Templates | No parse errors | With parse errors |
| --- | ---: | ---: | ---: |
| `../b3-app/fbs` | 201 | 186 | 15 |
| `../b3-app/hdb` | 472 | 470 | 2 |

These counts include one vendored Smarty `debug.tpl` in each root. They do not
replace or update measurements of the fixed `corpus/application/` or either
upstream corpus. No-error trees were not structurally reviewed.
Generated-parser SHA-256:
`74f9cdb118613c726870ea180f5c79fe88134315d9a64681cee83ee66d3c31b0`.
Local reports preserve per-source hashes and error locations:
`/tmp/smarty-current-fbs.json`, `/tmp/smarty-current-hdb.json`,
`/tmp/smarty-current-diagnosis.json`, and
`/tmp/smarty-current-template-audit.md`. These temporary files are local evidence,
not tracked fixtures or permanent evidence dependencies; rerun reports if absent.

Smarty 5.8.4's recording syntax parser accepted all 17 failing files. Its actual
compiler also accepted reduced examples of all six diagnosed syntax families
without rendering. Diagnostic substitutions in in-memory copies removed every
reported Tree-sitter error. This identifies parser gaps responsible for these
errors; it does not validate whole-template compiler block pairing, application
plugins, runtime values, inheritance resolution, HTML or JavaScript.

| Confirmed gap | Reduced compiler-accepted example | Next task |
| --- | --- | --- |
| Spaced branch header | `{if $a}A{else if $b}B{else}C{/if}` | [046](tasks/046-else-if-branches.md) |
| Tags inside quoted attributes | `{html_options options=$options selected="{if $a}1{else}0{/if}"}` | [047](tasks/047-tags-in-quoted-attributes.md) |
| Qualified static call | `{b3\Libs\Asset\CacheBuster::build_importmap()}` | [048](tasks/048-namespaced-static-method-calls.md) |
| Braced modifier argument | `{"prefix"\|cat:{$id}}` | [049](tasks/049-braced-modifier-arguments.md) |
| Output suffix | `{$value nofilter}` | [050](tasks/050-output-nofilter.md) |
| Ternary expression | `{$group_id == -1 ? $main_group_id : $group_id}` | [051](tasks/051-ternary-expressions.md) |

Task 048 uses neutral namespaces in its tracked fixtures and confirms their
compile-only behavior. Task 046's implementation removes the branch-related errors in
eight FBS templates; Task 047 clears three quoted-conditional templates and has passed
independent implementation review. The separate corpus
reports show the remaining FBS errors in `view_actions/edit_action.tpl`,
`view_incident_report/change_owner.tpl`, and vendored `debug.tpl`; HDB still has
the user-rights template and vendored `debug.tpl`. `index.tpl` needs 048,
`change_owner.tpl` and debug templates need 050, the HDB user-rights template
needs 051, and FBS `edit_action.tpl` needs both 046 and 049. Do not add gains
from individual tasks blindly. Tasks 046–048 are complete after independent
review; Tasks 049–051 remain planning work.
