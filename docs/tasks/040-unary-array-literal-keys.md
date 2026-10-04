# 040 — Unary expressions as array literal keys

**Status:** complete; independent implementation review accepted (2026-10-04).
**Type:** standard Smarty 5 array-literal expression syntax.
**Depends on:** [010 array literals](010-array-literals.md),
[005 condition operators](005-condition-operators.md), and
[031 word boolean operators](031-word-boolean-operators.md).
**Brief review:** accepted by the independent task-creation reviewer before
implementation. The independent completion reviewer accepted the implementation
and evidence after the exact range assertions were added.

## Corpus motivation and diagnosis

The hash-matched Task 039 application report
`/tmp/task039-application-after.json` records 466/467 files clean and one
failure, `view_orders/new_article.tpl`. Its `grammarSha256` is
`d81e4156730a82047c19e626f26a7adef0002c072bea81fda1cbfb78142bc521`; the
corresponding `src/parser.c` SHA-256 is
`bac0ebadfa4d0168a9ecf9228d380d982280dcb86c9fb4dcb1496804b2c572ce`. The
source file hash is
`0143955817a62affab421698448caedc9e96cd9c8d3db35c12b48b104319c86e`, matching
the report. The sole reported error is `[197,305)` (line 5, column 13),
covering the `html_options` tag whose `options` value contains:

```smarty
array(-1=>" ")+$yes_no_options
```

The cause is the negative unary key, not array addition or generic-tag
attribute composition in general. Current `grammar.js` defines
`array_element.key` as `$._primary`; prefix signs and `not` are represented by
`unary_expression` above the primary level. With a positive key,
`{html_options options=array(1=>" ")+$yes_no_options selected=$selected}`
already produces a clean tree whose `options` attribute owns a
`binary_expression` (array literal left, variable right), followed by the
`selected` attribute. The equivalent `-1` key fails, as does the isolated
output `{array(-1=>" ")}`. Therefore the observed application syntax is an
array-key boundary gap that composes with already-supported attribute
addition; it is not missing arithmetic support.

Smarty 5.8.4 evidence was reproduced through the pinned recorder and full
compiler. Both accept `{array(-1=>"v")}`,
`{html_options options=array(-1=>" ")+$yes_no_options}`, and the complete
application `html_options` tag copied from line 5. The recorder reports a
single `html_options` event and the ordered attribute names; it does not expose
the array key or the value tree. The controlled full compiler accepts the
fixed complete tag in compile mode. Neither observation verifies runtime
values or plugin behavior. Hand-authored trees below define the structure.

The boundary is not arbitrary expression keys: pinned Smarty rejects the
unparenthesized compound key `array(1+2=>"v")` with an unexpected `=>` error.
The parenthesized form `array((1+2)=>"v")` already parses and compiles. This
task should admit the existing unary-expression family in a key while retaining
that distinction. Probes confirmed the pinned parser/compiler accept keys
`-1`, `+1`, `-$x`, `!$x`, and `not $x`; these cover signed and logical unary
forms without claiming arbitrary compound keys. The current grammar produces
`unary_expression` nodes for these forms in expressions, but rejects them in
the array `key` field.

Keep typecasts outside this task. Pinned Smarty 5.8.4 independently accepts
`{array((int) $x=>"v")}` in both the recorder and full compiler, but the current
Tree-sitter parser reports an error inside the array literal. This is a
distinct standard syntax gap: the pinned
`vendor/smarty/smarty/src/Parser/TemplateParser.y:730-732` defines
`value ::= TYPECAST value`, and `:1356-1358` allows `value APTR expr` as an
array element, so typecasts are valid keys. A unary-key production must not be
treated as evidence for casts. Queue a separate Task 041 for typecast syntax
and its array-key composition; create its bounded brief after Task 040 has
passed review and been committed, preserving the one-task-at-a-time loop.

## Bounded scope and tree contract

Allow a supported unary expression in `array_element.key`. Preserve its normal
`unary_expression` node, `operator` and `argument` fields, and source ranges
inside the array element's `key` field. Keep all existing primary-expression
keys and values unchanged. Do not accept an unparenthesized binary expression
as a key, change arithmetic precedence, or infer runtime key coercion.

For the standalone minimized source `{array(-1=>"v")}`, the required shape is:

```text
(source_file
  (output
    value: (array_literal
      (array_element
        key: (unary_expression
          argument: (number))
        value: (string)))))
```

For the word-unary form `{array(not $x=>"v")}`, retain its named operator:

```text
(source_file
  (output
    value: (array_literal
      (array_element
        key: (unary_expression
          operator: (word_operator)
          argument: (variable name: (identifier)))
        value: (string)))))
```

As in the existing tree contract, the symbolic `-` token is anonymous and is
not printed in the S-expression; the Node check must assert that the unary
node's `operator` field has text `-`. The `not` operator remains a named
`word_operator` child.

For the generic-tag composition
`{html_options options=array(-1=>" ")+$yes_no_options selected=$selected}{$after}`,
preserve this ownership:

```text
(source_file
  (custom_tag
    name: (identifier)
    (attribute
      name: (identifier)
      value: (binary_expression
        left: (array_literal
          (array_element
            key: (unary_expression argument: (number))
            value: (string)))
        right: (variable name: (identifier))))
    (attribute name: (identifier) value: (variable name: (identifier))))
  (output value: (variable name: (identifier))))
```

The `options` attribute owns the complete addition expression; the key is the
unary expression under the array element, not a sibling or a text fragment.
`selected` remains a second attribute and `{$after}` remains an independent
output. A direct unsigned-key control such as
`{html_options options=array(1=>" ")+$yes_no_options}` keeps its existing
tree shape. The array key is syntax only; Smarty's runtime treatment of array
keys is outside this contract.

This composition also exercises the `OP-array-key` cell in
[`docs/composition.md`](../composition.md). After implementation, update that
cell with the hand-authored unary-key tree and Node check, keep it `limited`
for the broader operator family, and state explicitly that the evidence covers
tested unary keys plus the already-supported parenthesized compound key. It
does not establish every arithmetic/comparison/boolean form as a direct key,
and it does not cover cast keys (queued separately as Task 041).

## Failing-first trees and checks

Before grammar changes, add manually specified trees and a dedicated Node
check. Use `fixtures(filename)` for valid Smarty recorder cases. Assert fields,
child order, `root.hasError`, and source slices; the recorder's event projection
cannot establish array-key structure.

1. Add standalone output fixtures for `{array(-1=>"v")}` and
   `{array(not $x=>"v")}`. Include `+1` or `!$x` as a Node/reference probe if
   needed to guard both unary kinds; keep the initial fixture set bounded.
   Trees must show the unary node under `array_element.key`, with its operator
   and full argument retained. Keep integer/string, variable, bare identifier,
   and parenthesized compound keys as controls.
2. Add the generic-tag fixture above with the complete array-plus-variable
   attribute expression, the following `selected` attribute, and trailing
   output. Assert the `binary_expression` left/right fields, operator, array
   element key/value fields, attribute ownership/order, and exact tag/
   attribute/key/expression/output ranges. Include the application's minimized
   and exact `html_options` forms in pinned recorder checks; compile the fixed
   complete tag with `fullEngine(..., {mode: 'compile'})`. Do not run arbitrary
   application templates through the full engine or claim plugin/runtime
   semantics.
3. Verify unary keys do not change arithmetic precedence or parenthesized
   compound-key structure. Smarty accepts `array((1+2)=>"v")` but rejects
   `array(1+2=>"v")`; the latter must remain an error rather than being
   admitted as a full binary-expression key. Use the full engine as well as
   the recorder for the rejection because the recorder and compiler should
   agree on this syntax boundary.
4. Hand-author malformed recovery for a missing unary operand, for example
   `{html_options options=array(-=>"v") selected=$selected}{$after}`. Pinned
   Smarty 5.8.4 rejects it at `=>`. Require a genuine Tree-sitter error and a
   separate, error-free `{$after}` output; preserve the tag/attribute boundary
   and `selected` attribute as navigable nodes if the recovery shape permits.
   Also cover a missing array value after a valid unary key, with compiler
   rejection and a later output preserved. Do not turn invalid syntax into
   text-only success or broaden the positive key production to arbitrary
   binary keys.
5. Add an edit sequence that changes a supported primary array key to a unary
   key, crosses through a missing-operand state, repairs it, and compares full
   incremental snapshots with fresh parses at each step. Include an edit at
   the `=>` boundary or adjacent attribute boundary if the selected fixture
   demonstrates a relevant recovery risk.
6. As part of evidence synchronization after implementation, update
   `OP-array-key` in `docs/composition.md` using the bounded status described
   above. Keep typecast array keys visible as the separate Task 041 gap; do not
   mark the whole operator family as supported by these unary witnesses.

## Reference limits and scope exclusions

The recording compiler checks tag names, ordered argument names, and argument
counts; it does not compare attribute values or their expression structure.
Use it as pinned acceptance evidence only, and use hand trees for node/field
shape. The fixed full engine compiles controlled examples but does not verify
application variable binding, runtime array values, or plugin execution.

Do not add generic-tag special cases, an `html_options` allowlist, application
variables, or a textual fallback. Do not implement array spread, assignment,
arbitrary expression keys, or unrelated arithmetic/operator forms here. Any
additional pinned standard key form discovered during review remains a project
gap and must be recorded rather than mislabeled invalid.

## Implementation and evidence (2026-10-04)

The failing-first check was observed before grammar changes: the new standalone
unary-key trees failed because the existing grammar produced errors at `-1`
and `not $x`. The bounded grammar change adds `$.unary_expression` alongside
`$._primary` only in `array_element.key`; it does not change expression
precedence, array values, generic-tag attribute grammar, or scanner behavior.
Generated sources were refreshed by the repository commands.

The hand-authored trees cover `-1` and `not $x` keys plus the
`html_options` attribute expression and following output. Node checks additionally
cover `+1`, `!$x`, `-$x`, the key `operator`/`argument` fields and ranges, exact
application-tag recorder acceptance, controlled full-engine compilation,
malformed missing unary operand and value recovery, rejection of an
unparenthesized binary key by the parser/recorder/full compiler, continued
acceptance of parenthesized compound keys, and incremental edits through a
missing operand. Existing primary key controls remain in the array corpus.

`npm test` passed: grammar typecheck, 490/490 Node checks, and 18/18 deliberate
mutation catches. The final full-gate log is `/tmp/task040-npm-test.log`,
SHA-256 `aa72d953bdf75045084b055254b0c3a3553f15e2d674d3d7626a7feaf43c83c5`.
After the range assertions requested by review, the full gate passed again;
that final log is `/tmp/task040-npm-test-review-revision.log`, SHA-256
`1cbd68dd7af56de1faad160dce0af98c534a957d50413a8f78a8fed69bef5b71`.
Focused `node --test test/unary-array-keys.test.mjs` also passed. The three
corpus reports are separate and all match generated parser
SHA-256 `f05e3f5bb3d439386ca9fc3f69d11c10fae2708b2f6657f49996f4b4eb3d2179`:

| Corpus | Before (Task 039 parser) | After | Report |
| --- | ---: | ---: | --- |
| Application | 466/467 clean, 1 failing | 467/467 clean, 0 failing | `/tmp/task040-application-after.json`, SHA-256 `086647da7dad4bdfb567e09cd32a970642f20a95015d32ae5e58a844c7aa8621` |
| Upstream Smarty core | 31/33 clean, 2 failing | 31/33 clean, 2 failing | `/tmp/task040-upstream-core-after.json`, SHA-256 `2236f21e7542b98abae0faf4f79f47dfbc80ed8fe5cbd2ce90648e11a83a590f` |
| Upstream demo | 0/1 clean, 1 failing | 0/1 clean, 1 failing | `/tmp/task040-upstream-example-after.json`, SHA-256 `776ed49cedb0a7df4198fb18ea3f76f2261ac2f51c7592aaa6a7f313189b2fda` |

Before reports are the Task 039 hash-matched files under `/tmp/task039-interim-*.json`.
All source-file hashes are unchanged across each pair. The application corpus
has exactly one newly clean file, `view_orders/new_article.tpl`, and no
regressions; the two upstream corpus roots have no changes in clean status.
Structural inspection of the newly clean template confirms its line 5
`html_options` remains one `custom_tag` with five ordered attributes. Its
`options` value is a `binary_expression` whose left side is an `array_literal`
with an `array_element.key` `unary_expression` spanning `-1` (argument `1`),
and whose right side remains `$yes_no_options`; `selected=$new_nl_is_repairable`
remains a separate attribute. The root has no errors.

Limitations remain explicit: unparenthesized compound keys such as
`array(1+2=>"v")` are rejected, while the parenthesized form is supported.
Typecast keys such as `(int) $x` remain a separate confirmed standard syntax
gap for Task 041. Core and demo failures listed in their reports remain
unresolved project gaps.

## Completion review and next task

The implementation owner first adds the trees and failing checks, then changes
`grammar.js` only (plus a justified scanner change if evidence requires one),
regenerates, and runs the full `npm test` gate. Preserve separate hash-matched
reports for the application, upstream Smarty core, and upstream demo outside
`build/`; compare identical source hashes and inspect any newly clean tree for
an explicit unary `array_element.key` and preserved surrounding nodes. Report
remaining failures and regressions.

The independent task-completion reviewer verified the accepted brief, bounded
grammar change, hand-authored trees and ranges, reference/compiler observations,
malformed recovery, incremental edits, generated parser hash, and all three
separate corpus reports. The initial review requested exact ranges and source
slices for the generic-tag expression, array, element, `selected` attribute,
and trailing output. Those assertions were added; the focused check and full
`npm test` passed again, and the reviewer accepted the revision. No findings
remain within this task's scope. The orchestrator marks this task complete.

Task 041, for the separately confirmed typecast-key syntax, is the next task to
create and review after this commit.
