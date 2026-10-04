# 041 — Smarty typecast expressions

**Status:** complete (2026-10-04); accepted by the independent task-creation and task-completion reviewers.
**Type:** standard Smarty 5 expression syntax.
**Depends on:** [005 symbolic operators](005-condition-operators.md),
[010 array literals](010-array-literals.md),
[004 instance method calls](004-object-method-calls.md), and
[040 unary array keys](040-unary-array-literal-keys.md).

## Motivation and source evidence

Task 040 established a concrete missing array-key form: Smarty 5.8.4 accepts
`{array((int) $x=>"v")}` in both the recording parser and full compiler, while
the current Tree-sitter grammar reports an error inside the array. That is not
an array-only grammar feature. The pinned Smarty lexer defines `TYPECAST` in
`vendor/smarty/smarty/src/Lexer/TemplateLexer.plex:340` as the case-insensitive
forms `(int)`, `(integer)`, `(bool)`, `(boolean)`, `(float)`, `(double)`,
`(real)`, `(string)`, `(binary)`, `(array)`, and `(object)`, followed by
optional whitespace. The parser defines `value ::= TYPECAST value` at
`vendor/smarty/smarty/src/Parser/TemplateParser.y:730`; `value` is the shared
operand grammar used by expressions, and `arrayelement` accepts `value` as a
key at lines 1356–1364.

Read-only observations against the pinned recorder and full compiler confirm
casts in output expressions, conditions, array keys and values, method-call
arguments, modifier arguments, and bracket indices. For example, Smarty accepts
and compiles `{(int) $x}`, `{if (int) $x > 0}Y{/if}`,
`{array((int) $x=>"v")}`, `{$o->f((int) $x)}`,
`{$x|default:(int) $y}`, and `{$a[(int) $x]}`. The current grammar rejects or
misclassifies these expressions. In a generic tag,
`{widget value=(int) $x}` produces one named `value` argument in the recorder;
the current tree instead has a parenthesized identifier value plus a spurious
positional `$x` argument. The known built-in
`{assign var=x value=(int) $x}` also confirms named-attribute composition.

The current fixed corpora contain no confirmed cast expression use. Task 040's
independently minimized cast-key probe is the direct trigger, and the pinned
shared `TYPECAST value` production establishes that this is a general standard
expression gap that needs complete expression-context evidence. Do not claim a
corpus pass-rate improvement from this task unless hash-matched reports show one.

The `real` spelling is recognized by the lexer/parser and accepted by the
recorder/compiler, but the full engine reports that the `(real)` cast has been
removed at runtime. Treat this as source syntax only; do not test runtime cast
semantics for it. The reference adapter records syntax events and cannot verify
the cast node or operand. Hand-authored trees remain the structural contract.

## Bounded scope and proposed tree contract

Add the pinned Smarty typecast spellings as prefix expression forms in the
audited, currently supported parser contexts listed below. Keep casts within
those existing contexts; do not make this task add unsupported call forms or
claim coverage for untested contexts. Preserve a distinct `typecast_expression` node with
the cast spelling in an `operator: (typecast_operator)` field and the complete
cast operand in an `argument` field. The operator leaf spans only the
parenthesized cast spelling; whitespace between the cast and operand is not
part of it. Retain exact source case. The expression must not be flattened to
text, treated as an ordinary parenthesized identifier, or represented as a
bare `unary_expression` without a visible cast type.

For `{(int) $x}`, the required shape is:

```text
(source_file
  (output
    value: (typecast_expression
      operator: (typecast_operator)
      argument: (variable name: (identifier)))))
```

The pinned production recursively consumes one `value`. Thus in
`{(int) -$x + 1}`, the cast owns the complete unary `-$x` operand, and the
addition remains outside the cast:

```text
(source_file
  (output
    value: (binary_expression
      left: (typecast_expression
        operator: (typecast_operator)
        argument: (unary_expression argument: (variable name: (identifier))))
      right: (number))))
```

Verify this boundary against the full compiler before finalizing it. A cast
around a parenthesized compound operand keeps the inner binary tree under
`parenthesized_expression`, while a compound expression after the cast remains
outside unless parenthesized. Existing unary, modifier, and arithmetic
precedence must remain intact.

Required compositions include an output; `if`/`elseif` comparison; unknown-tag
positional and named attribute values; the built-in assignment attribute; an
instance method argument; modifier input and argument; a bracket index; an
array value; and an array key. For the positional value, use
`{widget $a + (int) $x}`: Smarty records one positional argument, while the
current grammar incorrectly splits off `$x` as another positional argument.
For the named value, use `{widget value=(int) $x}`: Smarty records one named
attribute, while the current grammar splits off `$x`. The hand trees must show
the complete expression under the original argument/attribute and no extra
argument. Unknown-tag examples use the recorder for parser acceptance; they do
not claim plugin compilation or semantics. The `(array)` spelling is a cast
only when used in `(array) value`; `array(...)` remains the existing
array-literal spelling. Ordinary parenthesized values, bare identifiers, and
all existing primary/unary forms retain their existing node types and
boundaries.

The Task 041 context inventory is explicit: output, `if`/`elseif`, generic-tag
positional and named values, built-in assignment attribute, instance method
argument, modifier input/argument, bracket index, and array key/value are
required. Assignment RHS, foreach sources, static class-method arguments,
standalone function-call arguments, loop bounds, and other pairings remain
unknown and outside this brief. In particular, `{Thing::f((int) $x)}` is
accepted by Smarty but does not establish the static-method tree in this task.

Do not add standalone or namespaced function calls, dynamic methods, class
casts outside the pinned list, assignment/ternary/coalescing syntax, or PHP
runtime cast evaluation. `real` stays in the parse contract despite its runtime
removal notice because the pinned Smarty lexer/parser still recognizes it.

## Failing-first trees and checks

Before grammar changes, hand-author expected trees and add a failing Node check.
Keep cast spellings and each context independently inspectable; a green parser
root without the cast node and fields is not support.

1. Add output trees for `(int) $x`, `(INT)$x`, `(string) 12`, `(array)$x`,
   `(int) -$x`, and `(int) ($x + 1)`. Assert exact cast spelling/range,
   operand ownership, source slices, and that whitespace between cast and
   operand is excluded from the `typecast_operator` node. Test all eleven
   pinned spellings through reference acceptance; include upper/mixed-case
   witnesses and preserve exact spelling. Check `(array)` as a cast separately
   from `array(...)` as a literal.
2. Pin typecast precedence using the full compiler with fixed primitive
   values: casts around a unary operand, outside/inside arithmetic, and explicit
   parentheses must distinguish cast-operand ownership from the surrounding
   expression. In particular, verify the proposed tree for
   `{(int) -$x + 1}` before implementation. Do not infer grouping from recorder
   success or runtime array/object coercion.
3. Add trees/checks for the relevant supported composition paths: an `if` or
   `elseif` comparison; `{widget $a + (int) $x}` with one complete positional
   argument; `{widget value=(int) $x}` with one complete named attribute and
   no extra positional argument; `{assign var=x value=(int) $x}`; an instance
   method argument; `{$x|default:(int) $y}`; a cast in a supported modifier
   input; `{$a[(int) $x]}`; and both array key and array value positions. Add
   explicit hand trees for both unknown-tag examples, with the entire cast
   under the original `argument` or `attribute.value` and no spurious sibling
   argument. Assert every full field tree manually. Compare recorder events only where its
   projection is informative; use the full compiler for the known built-in
   assignment and fixed expression/precedence observations.
4. Check that `array((int) $x=>"v")` has a `typecast_expression` in
   `array_element.key`, while the adjacent existing unary-key and
   parenthesized-compound-key shapes remain unchanged. Do not widen the
   existing rejection of unparenthesized binary keys.
5. Hand-author malformed recovery for a missing cast operand, using
   `{array((int)=>"v")}{$after}` because Smarty rejects the cast key at `=>`
   while the current grammar misreads `(int)` as a parenthesized identifier
   key. Require a genuine error localized to the malformed array/cast region,
   pinned recorder/full-compiler rejection, and a separate error-free
   `{$after}` output. Also cover an invalid cast spelling such as
   `{array((foo) $x)}{$after}`, preserving the following output. Add the valid
   ordinary parenthesized identifier control `{(foo)}` with the expected
   `output(value: parenthesized_expression(identifier))` tree and recorder
   acceptance; `(foo)` must not be reclassified as a cast.
6. Add an edit sequence changing `(int) $x` to `(string) $x`, deleting the
   operand into the malformed state, then restoring it. Compare complete
   incremental snapshots with fresh parses at every step and keep neighboring
   output/tag/block syntax separate.
7. Run `npm test` and preserve separate application, upstream-core, and
   upstream-demo reports outside `build/`, hash-matched to the generated
   parser. Inspect regressions and any newly clean trees; report zero corpus
   delta honestly if none of the fixed inputs use casts. Update this brief,
   `docs/features.md`, `test/CONTRACT.md`, and the relevant composition row
   with the accepted tree shape and evidence only after implementation review.

## Reference limits and reviewer questions

**Brief review:** accepted after the independent reviewer rechecked the
corrected context inventory and composition matrix. Implementation evidence
is assembled; implementation review is pending.

## Implementation evidence (2026-10-04)

The generated grammar exposes `typecast_expression` with `operator:
(typecast_operator)` and `argument` fields. Hand-authored trees cover every
accepted context, all eleven spellings and case variants, ordinary
parenthesized identifiers, the `(array)` / `array(...)` distinction, malformed
cast recovery, and incremental replacement/deletion/restoration. The controlled
full-engine cases verify the unary operand boundary and arithmetic outside the
cast; pinned parser source defines `value ::= TYPECAST value`, with arithmetic
productions consuming one `value` operand.

`npm test` exited **0**: grammar generation/build and type checking, **364/364**
corpus trees, **507/507** Node/reference/edit checks, and **18/18** deliberate
mutation checks. Its captured output is `/tmp/task041-npm-test.log`, SHA-256
`3fb092800857de5ae7343895f2eff5cbc1066b6c503e6056c64db34102e89dc1`.
`git diff --check` also passed. The separate corpus reports are saved outside
`build/`:

- `/tmp/task041-application-after.json`: **467/467** clean.
- `/tmp/task041-upstream-core-after.json`: **31/33** clean.
- `/tmp/task041-upstream-demo-after.json`: **0/1** clean.

Report SHA-256 values are `627633c9b3f124ccbfcff4bb975eb1162530a75b0f7ae845d59a2dd6c18055b7`
(application), `6c400eb163aac33a59fb0302b3ec5afe6e3e8a0f0f8955f4693ad8d743949e58`
(upstream core), and `bbc05e60e8490ec0fddfb7bc3720434d8e9eaf9477d7901b6bcac781da5fb41d`
(upstream demo). All three reports were generated after the final parser build.

Each report is hash-matched to `src/parser.c` SHA-256
`9410d63db9aac0a655925d375e7cf25a2463835972029c784e268546209fa9d9`. Their
corpus file hashes match the Task 040 reports. Comparison found no newly clean
files and no regressions in any of the three separate corpora; the application
corpus was already 467/467 clean before this task. The upstream core remains
31/33 and the demo remains 0/1. These results do not claim support for
unreviewed tree shapes; independent completion review accepted the implemented
and tested tree shapes without findings.

The independent completion reviewer verified all accepted spellings, ranges,
precedence, composition contexts, malformed recovery, incremental edits,
generated sources, and the separate corpus evidence. Review findings on the
lexer comment and mixed-case reference check were corrected and rechecked;
no findings remain.

The recorder confirms parser/compiler acceptance and tag/argument projections;
it does not expose cast type, expression structure, precedence, or runtime
values. The full compiler may compile expressions without validating runtime
coercions. Keep full-engine cases fixed and controlled. Do not execute local
application templates.

The task-creation reviewer verified the proposed
`typecast_expression` shape and precedence from the pinned grammar/compiler,
all eleven spellings and case behavior, the `(array)` ambiguity, and whether
the named contexts are valid independently of plugin semantics. If Smarty's
actual cast operand boundary differs from the proposed tree, revise this brief
before implementation rather than adjusting expected trees afterward.
