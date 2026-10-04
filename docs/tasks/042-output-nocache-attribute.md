# 042 — Smarty output `nocache` attribute

**Status:** complete (2026-10-04); implementation review accepted.
**Type:** standard Smarty 5 output syntax.
**Depends on:** [011 standalone function calls](011-standalone-function-calls.md)
and the existing expression forms used as output values.

## Motivation and exact corpus evidence

The hash-matched Task 041 upstream-core report remains at 31/33 clean files.
Its two failures are exactly the standard output suffixes `{$test nocache}`
and `{$param nocache}` in these checked-in Smarty 5.8.4 sources:

| Source | SHA-256 | Failure location |
| --- | --- | --- |
| `TemplateSource/TagTests/BockExtend/templates/002_parent.tpl` | `d3bb6b3c6a9c8b640911704864e1741fb428098f9b73fcb4b4bb613719082445` | line 1, column 6; `{$test nocache}` |
| `TemplateSource/TagTests/TemplateFunction/templates/test_template_function_002.tpl` | `8e30dc82343656336c6436ca335644a2c46e767a9cd80ef7dc57cbd97f3da589` | line 1, column 54; `{$param nocache}` |

The report is `/tmp/task041-upstream-core-after.json`, generated against
`src/parser.c` SHA-256
`9410d63db9aac0a655925d375e7cf25a2463835972029c784e268546209fa9d9`.
The application and demo reports are separate: Task 041 records 467/467 clean
application files and 0/1 clean demo files. These are independent corpus roots;
do not combine their counts.

In the pinned `vendor/smarty/smarty/src/Parser/TemplateParser.y`, the lexer
special case for simple `{$variable nocache}` invokes
`compilePrintExpression(..., ['nocache'])` (around lines 303–307). General tag
output uses `outattr ::= output attributes` (around line 375), with
`output ::= variablevalue | value | expr` (around lines 379–385). Therefore the same suffix
feature is accepted for existing expression outputs, including modifiers,
calls, and parenthesized or compound expressions; it is not limited to the
special simple-variable token. `TemplateLexer.plex` defines the optional
`nocacherdel` suffix for simple outputs (around line 291).

Read-only checks through the pinned recording adapter and full compiler
confirmed bare `nocache` after a simple variable, modifier output, parenthesized
arithmetic, and Smarty's built-in `isset` function output. Bare name case variants (`nocache`,
`NoCache`, `NOCACHE`) compile. The attribute may repeat, and its occurrence
order is preserved by the parser; both `nocache nocache` and valued repetitions
compile. `nocache` follows the complete output expression/modifier chain. For
`{$x nocache|escape}`, the recorder accepts the source and emits modifier/output
events, while the full compiler rejects it as too many shorthand attributes.
That recorder projection does not show whether it recognized or how it bound a
modifier after the attribute; use this solely as a recorder/full-compiler
mismatch check, without asserting its parsed tree ownership. A missing value
(`nocache=`) is rejected by both parser and compiler.

The full compiler accepts valued `nocache` values `true`, `false`, `1`, and
`0`, quoted or unquoted, and accepts whitespace around `=`. Its option map is
case-sensitive for textual values: `TRUE` and `True` are rejected. The parser
accepts a wider value expression such as `nocache=$flag` or `nocache="yes"`,
while full compilation rejects those values as illegal option-flag values.
Represent syntactically accepted values with their normal expression trees;
do not encode compiler validation as an expression grammar restriction. The
recording adapter confirms parse acceptance and output-event order only; it
does not expose output attribute names, values, caching behavior, or runtime
effects.

## Bounded scope and proposed tree contract

Support trailing `nocache` attributes on every currently supported output
value. Keep the existing `output` node and `value` field. Each suffix is a
direct `attribute` child of that output, in physical source order. A bare
attribute has `name: (identifier)` and no `value`; a valued occurrence has the
same `name` field plus a `value` field containing the complete supported
expression. Keep the original spelling/range of the attribute name and
expression. Do not wrap the output value in an attribute node or flatten the
value into text.

For the upstream witness `{$test nocache}`, the proposed tree is:

```text
(source_file
  (output
    value: (variable name: (identifier))
    (attribute name: (identifier))))
```

For a valued suffix, preserve both the ordinary expression tree and the
attribute value:

```smarty
{$x|escape nocache=true}
```

```text
(source_file
  (output
    value: (modifier_expression
      value: (variable name: (identifier))
      name: (identifier))
    (attribute
      name: (identifier)
      value: (boolean))))
```

Every repeated `nocache` occurrence remains a separate direct `attribute`
child, ordered as written. A Smarty built-in function output retains its call
under `output.value` and owns the suffix itself:

```text
(source_file
  (output
    value: (function_call_expression
      name: (identifier) ; `isset`
      argument: (variable name: (identifier)))
    (attribute name: (identifier))))
```

The compiler witness for this sketch is `{isset($x) nocache}`. An arbitrary
function such as `{f($x) nocache}` is recorder-accepted but requires plugin
resolution and is not a full-compiler acceptance witness.

This is one bounded feature because Smarty uses the same `outattr` production
for the existing output expression alternatives; the special simple-variable
lexer branch applies the same `nocache` contract. Include supported
function-shaped outputs covered by Task 011, using `isset` for full-compiler
acceptance evidence. This corrects Task 011's valid-but-deferred output
attribute boundary for `nocache` specifically; it does not establish plugin
availability for arbitrary function names.

Do not add other output attributes (`assign`, `nofilter`, or arbitrary
attributes), arbitrary standalone output attribute semantics, output caching
behavior, or plugin/runtime execution. `assign` and `nofilter` are known,
compiler-valid output attributes but remain separate standard gaps. The
recorder accepts arbitrary attribute syntax, while the full compiler rejects
unknown output attributes. Keep `{widget nocache}` as a generic custom tag
with its existing positional argument interpretation; do not reclassify
unknown tags or broaden generic-tag attribute handling.

## Failing-first trees and checks

Before grammar changes, hand-author expected trees and add a Node check that
fails on the two upstream-shaped simple outputs. Store valid cases in
`test/corpus/output-nocache-attribute.txt`; use
`fixtures('output-nocache-attribute.txt')` explicitly. Do not update trees from
parser output.

1. Pin the two minimized outputs `{$test nocache}` and `{$param nocache}` with
   the tree shapes above. Add direct checks for field ownership, exact source
   ranges/text, direct child order, and attribute spelling. Compare recorder
   output events, while documenting that this projection cannot see the
   attribute.
2. Add hand trees for `{($x + 1) nocache}`, `{$x|escape nocache}`,
   `{isset($x) nocache}`, and valued `{$x nocache=true}`. Test case-preserving
   bare names and repeated bare/valued occurrences. Include a compound
   expression plus following text/output to prove the attribute stays on the
   expression output and following syntax remains a sibling.
3. Check composition inside an `if` block and adjacent to an unknown generic
   tag, for example
   `{if $enabled}{$value nocache}{/if}{widget value=$value}{$after}`. Require
   the output and its attribute to stay under the existing `if` body, retain
   the generic tag's name/value structure, and keep `{$after}` as a separate
   output. Also cover a built-in function-shaped output (`{isset($x) nocache}`)
   with full-compiler acceptance, because the shared pinned `outattr` rule
   applies to it. Other supported function-call trees may use recorder checks,
   but must not claim full compilation without an available function/plugin.
4. Check value boundaries and compiler/parser distinctions: `nocache=true`,
   `false`, `1`, and `0` compile; quoted/unquoted legal values preserve their
   normal boolean/number/string tree. A syntactically accepted expression
   value such as `$flag` remains fully structured although the full compiler
   rejects the illegal option value. Record that uppercase `TRUE` is rejected
   by the compiler even though recorder parsing succeeds. Do not make a
   compiler-value rejection into a parser error.
5. Add malformed/recovery coverage for `{$x nocache=}{$after}`: require a
   genuine localized Tree-sitter error, pinned parser/compiler rejection, and
   a separate error-free `{$after}` output. Check `{$x nocache|escape}` only
   as a recorder/full-compiler mismatch: require recorder acceptance, full
   compiler rejection, and report its modifier/output event projection without
   asserting that the recorder established modifier-after-attribute ownership
   or recognition. Keep `{$x foo=1}{$after}` and `{$x nofilter}{$after}`
   explicitly outside this task. `nofilter` is a known compiler-valid output
   attribute; these cases establish no tree support for other output
   attributes, and must not silently treat them as part of this feature.
6. Test edits across the suffix boundary: bare `nocache` to `nocache=true`,
   deletion of the valued expression into malformed `nocache=`, restoration,
   then removal of the suffix. Compare full incremental snapshots with fresh
   parses at every step. Keep adjacent text, a generic tag, and a trailing
   output distinct throughout.
7. Run `npm test`. Save three independent corpus reports outside `build/`:
   application, upstream core, and upstream demo. Hash-match each to the final
   generated parser and source manifests; inspect the two newly clean core
   trees structurally and inspect any changed application/demo files. Report
   separate before/after counts, failures, regressions, and the tree evidence.
   Do not claim an application-corpus gain unless its file hashes and report
   show one. Update the output row, contract, Task 011 boundary note, and this
   brief's implementation evidence only after implementation review.

## Reference and review boundary

The pinned recorder establishes parser acceptance and output event placement,
not the suffix's name/value tree, option meaning, or cache behavior. Use
hand-authored trees for structure and the full compiler for allowed versus
invalid option values. Do not execute local application templates. The
implementation reviewer should verify that both upstream failures become
structured output nodes with direct attribute ownership, that repeated attrs
stay separate and ordered, that invalid/missing values recover without
swallowing `{$after}`, and that generic tags and non-`nocache` output
attributes remain in their prior scope.

## Brief review and revisions (2026-10-04)

The independent task-creation reviewer returned `revise` with two findings:

1. **Function-call witness:** replaced invalid `{$f($x) nocache}` with the
   compiler-confirmed built-in `{isset($x) nocache}` in the evidence, tree
   sketch, and planned fixtures. The brief now states that arbitrary function
   calls accepted by the recorder do not establish full-compiler acceptance
   because plugin resolution is separate.
2. **Modifier after the suffix:** retained `{$x nocache|escape}` only as a
   recorder/full-compiler mismatch check. The brief says the recorder's
   modifier/output events do not prove modifier-after-attribute ownership or
   recognition and requires no tree ownership assertion for that case.

The review also confirmed `assign` and `nofilter` are known compiler-valid
output attributes. They remain intentional separate gaps; the brief now
distinguishes them from arbitrary attributes that the full compiler rejects.

## Implementation and corpus evidence

Implemented the scoped case-insensitive output suffix with an external scanner
token that is active only at the output suffix boundary. It recognizes the
exact `nocache` spelling after Smarty whitespace and rejects identifier/hyphen
continuations; ordinary generic-tag parsing remains unchanged. The suffix
value rule reuses the established structured output-value set and adds
suffix-specific word equality, word relational, bitwise `&`, and
divisibility-expression aliases. These additions live only in
`_output_nocache_value`; the separate `_index_value` rule is unchanged. Bare
static identifiers remain excluded at this suffix boundary so
`{widget nocache}` stays a custom tag with a positional identifier.
`output.value` retains the complete expression; each bare or valued occurrence
is a direct ordered `attribute` child. Missing values report a local error and
preserve the tail.

Hand-authored trees cover the two upstream witnesses, arithmetic, modifiers,
repeated/case-varied suffixes, boolean/number values, `isset`, methods, static
calls, section properties, block and generic-tag composition, and the ambiguous
generic-tag boundary, plus `ne`, `neq`, `GTE`, mixed boolean/comparison
expressions, and bitwise `&`. Node checks cover operator spelling/case and
structure, exact suffix ranges/order, recorder and full-compiler distinctions,
invalid/missing values, incremental edits, and the recorder/full-compiler
mismatch for `{$x nocache|escape}` without assigning modifier ownership from
the recorder projection. `assign`, `nofilter`, and arbitrary output attributes
remain outside the grammar feature.

The failing-first revision added four manually specified trees and a Node check.
Before the grammar edit, the new `ne`, `neq`, and `&` outputs failed as malformed
outputs. A full `$._expression` candidate fixed those examples but reclassified
`{widget nocache}` as output, so it was rejected. The bounded fix extends the
existing structured output-value set with only the missing binary families and
keeps the generic-tag identifier boundary. The mixed word-operator Node cases
also verify that `ne`/`neq` and case variants retain their `word_operator` text.
The existing index-access, dynamic-dot, and braced-index suites passed with
the output suite (68 checks); no index production or index tree was modified.

`npm test` exited **0**: **378/378** Tree-sitter trees, **528/528** Node,
reference, recovery, and edit checks, and **18/18** intentional mutation checks.
The command was `npm exec --yes --package=node-gyp -- npm test` so the required
`node-gyp rebuild` pretest step was available in this environment. Captured
output is `/tmp/task042-r3-test.log`, SHA-256
`4a39d47d6dba765fdc308d2be65a75c6855d1ec72b6f98ca4f1cdcf3002607d8`.
Reports are separate and outside `build/`:

- Application: `/tmp/task042-r3-application.json`, **467/467** clean,
  SHA-256 `5d6c7c0a88c5e74de53bd8ab236728e420797bc6a5f0e59358218a845852de9a`.
- Upstream Smarty 5.8.4 core:
  `/tmp/task042-r3-upstream-core.json`, **33/33** clean,
  SHA-256 `cc07b3b6fbff86832b4a2aaea88d6e4bddfe58a34d92493409552aeca8b0027d`.
- Upstream demo: `/tmp/task042-r3-upstream-demo.json`, **0/1** clean,
  SHA-256 `2c79a90aaf67626ac5587b51284888a4c10720a9b59d34e32d5beb3781c7611d`.

All three reports have `grammarSha256`
`ddb74a5e2ebc64514cc699af75bda297c79a64ba4f09f65933ef9dc65cb3cdc0`, matching
the final `src/parser.c`. The source manifest hashes are `grammar.js`
`1c5dc23479e488573e141e57285051fec8d120c899e7aeee08ed50d4a04e02c7` and
`src/scanner.c`
`4de80b4488f9a238c7d9a9f6fa09e7afd704cf5031206fefb099b4bc8fae6d54`.
Against the previous Task 042 reports, all template hashes and clean statuses
match: the application remains **467/467** clean, upstream core remains
**33/33**, and the demo remains **0/1** clean with the same error in
`demo/templates/index.tpl` at line 27. Against the Task 041 baseline, the core
improves from **31/33** to **33/33** with no regressions; the only two newly
clean templates are `BockExtend/templates/002_parent.tpl` and
`TemplateFunction/templates/test_template_function_002.tpl`. The application
has no new clean files or regressions.

Structural inspection of the two newly clean core files confirms a clean
`output` with `value: (variable ...)` and a separate direct
`(attribute name: (identifier))` for each `nocache` suffix. Neighboring text,
other tags/outputs, and closers remain separate siblings. No existing expected
trees were changed.

## Implementation review (2026-10-04)

The independent completion reviewer accepted the final revision. It verified
that the operator aliases are confined to `_output_nocache_value` and
`_index_value` retains its prior behavior; the output operator matrix preserves
`output.value`, direct suffix ownership, and `{widget nocache}` as a generic
tag. It also rechecked malformed recovery, incremental edits, both newly clean
core trees, the full test log, and all three hash-matched corpus reports. The
reviewer confirmed 378/378 trees, 528/528 Node checks, 18/18 caught mutations,
application 467/467, upstream core 33/33, and upstream demo 0/1.
