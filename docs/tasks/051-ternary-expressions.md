# 051 — Conditional ternary expressions

**Status:** complete (2026-10-17).
**Type:** standard Smarty syntax gap.
**Dependencies:** 005 and the shared expression ladder.

## Motivation and confirmed witness

HDB `view_admin/users/view_user_rights_in_group.tpl:75` uses a ternary in a
JavaScript call argument emitted by Smarty. The outer JavaScript is text; the
missing feature is the expression inside the output:

```smarty
{$group_id == -1 ? $main_group_id : $group_id}
```

Smarty 5.8.4 accepts this in both the recording parser and full compiler. A
controlled render selecting the `-1` arm returns the supplied main-group ID.
This confirms that the HDB error is the missing ternary syntax, rather than a
malformed application template. Keep the JavaScript call text outside this
feature's syntax contract.

## Bounded scope and proposed tree contract

Add the full three-operand `condition ? consequent : alternative` expression
as `ternary_expression` with `condition`, `consequence`, and `alternative`
fields. Retain punctuation and full operand trees. The pinned Smarty
`TemplateParser.y` productions (the `expr ::= ternary` alternative and the
three full `ternary ::= expr QMARK ... COLON expr` alternatives) recursively
allow expression operands; they do not assign a separate precedence level.
Smarty emits these operators into generated PHP. Confirmed full-engine probes
show PHP's ordinary arithmetic grouping is retained: `{ $a + $b ? $yes : $no }`
renders the true arm when `$a + $b` is nonzero, and
`{ $flag ? $a + $b : $no }` renders the sum when the condition is true.
Explicit grouping must therefore remain explicit in the tree. PHP 8 rejects
unparenthesized chained ternaries at render time even though Smarty's full
compiler accepts the alternative-nested source; a controlled render raises
PHP's “Unparenthesized ... is not supported” fatal. Parenthesized nesting in
either arm compiles and renders. Preserve the nested tree and parentheses, and
record compiler acceptance separately from runtime validity; do not invent
left/right association for an unparenthesized chain.

Use the following hand-specified source/tree pairs to start the failing-first
corpus. The field names below are part of the proposed contract; complete the
existing variable/operator leaf shapes exactly as shown by neighboring
hand-written fixtures before implementation. For the HDB-shaped example, the
expected nesting is:

```text
(source_file
  (output value: (ternary_expression
    condition: (binary_expression
      left: (variable name: (identifier))
      operator: (comparison_operator)
      right: (number))
    consequence: (variable name: (identifier))
    alternative: (variable name: (identifier)))))
```

The other table entries likewise specify the full ternary field ownership;
their nested operand trees must remain present rather than being flattened.

| Source | Required structural result |
| --- | --- |
| `{$group_id == -1 ? $main_group_id : $group_id}` | `output(value: ternary_expression(condition: binary_expression(left: variable, operator: ==, right: number), consequence: variable, alternative: variable))` |
| `{$a + $b ? $yes : $no}` | Ternary whose `condition` is `binary_expression(left: $a, operator: +, right: $b)`; both arms are variables. Smarty render with `a=0,b=2` selects `yes`. |
| `{$flag ? $a + $b : $no}` | Ternary whose `consequence` is the complete `binary_expression($a + $b)`; Smarty render with `flag=1,a=2,b=3` yields `5`. |
| `{($a ? $b : $c) ? $d : $e}` | Outer `condition` is `parenthesized_expression(ternary_expression(...))`; render with `a=0,b=1,c=1,d=D,e=E` yields `D`. |
| `{$a ? $b : ($c ? $d : $e)}` | Outer `alternative` is `parenthesized_expression(ternary_expression(...))`; same controlled values yield `D`. |

The unparenthesized alternative-nested source `{$a ? $b : $c ? $d : $e}` is
accepted by Smarty's full compiler but its generated PHP cannot render under
the pinned PHP runtime. Keep this as a compiler observation, not a valid
rendering fixture or an asserted association. The parenthesized source pairs
above give structural and renderable coverage for nesting.

Shorthand `?:`, null-coalescing and other conditional operators are separate
work. Pinned recorder and full-compiler probes accept both `{$a ?: $b}` and
`{$a ?? $b}`; they remain explicit syntax gaps, not invalid Smarty. The
unparenthesized alternate-nested ternary is also accepted by the recorder and
compiler, while PHP 8 rejects its generated code at render time. Do not assert
runtime association or adopt arbitrary plugin/runtime semantics.

## Failing-first trees, composition, recovery and edits

- Add explicit tree fields for the tabled witness, arithmetic condition/arm,
  literal arms, and both parenthesized nesting directions. Add precedence
  fixtures combining ternary with comparison, boolean/word operators, and
  modifiers; state each grouping in the tree rather than inferring it from a
  successful parse.
- Probe and specify representative trees in every requested context. In each
  case the ternary retains `condition`, `consequence`, and `alternative` fields
  and all three variable operands; the context path is part of the fixture:

  | Source | Ternary's owning path |
  | --- | --- |
  | `{$x = $a ? $b : $c}` | `assignment_tag.value` |
  | `{if $a ? $b : $c}...{/if}` | `if_tag.condition` |
  | `{unknown value=$a ? $b : $c}` | `custom_tag.attribute.value` (recording-parser observation; arbitrary plugin full compilation is not a validity oracle) |
  | `{call($a ? $b : $c)}` | `function_call_expression.argument` |
  | `{$object->call($a ? $b : $c)}` | `method_call_expression.argument` |
  | `{$x|cat:($a ? $b : $c)}` | `modifier_expression.argument.parenthesized_expression` |
  | `{$x|cat:$a ? $b : $c}` | `ternary_expression.condition.modifier_expression`; the unparenthesized modifier binds before the ternary |
  | `{$items[$a ? $b : $c]}` | `array_access_expression.index` |
  | `{[$a ? $b : $c, ($a ? $b : $c)=>$value]}` | first `array_element.value`; second `array_element.key` inside `parenthesized_expression` |

  The recorder accepted the ternary in these contexts, but does not expose
  operand grouping. Explicit trees and full-engine probes settle the modifier
  boundary: `{$x|cat:$a ? $b : $c}` groups the modifier application as the
  ternary condition, while parentheses in `{$x|cat:($a ? $b : $c)}` place the
  ternary inside the modifier argument. The short-array spelling gives an
  unambiguous array-literal tree for the key/value composition.
- Use controlled full-engine rendering for arm selection and arithmetic
  grouping; recorder and compile-only results cannot verify runtime values.
  Record PHP 8's unparenthesized nested-ternary runtime limitation as described
  above.
- Test missing condition, consequent, colon and alternative, plus unterminated
  nesting. Keep later tag/output and enclosing block closers navigable.
- Edit a simple value into a ternary, delete/restore each delimiter and compare
  incremental snapshots. Add a meaningful precedence/ownership mutation if the
  existing operator mutation suite cannot catch the new failure mode.

## Implementation and completion gate

Before implementation, read `test/CONTRACT.md`, `docs/expanding.md` and
`docs/composition.md`. Add manually specified trees in `test/corpus/ternary-expressions.txt`
and a failing check in `test/ternary-expressions.test.mjs`; explicitly opt valid fixtures into
`fixtures('ternary-expressions.txt')`. Confirm the intended failure before changing grammar.
Keep malformed cases separate from the valid reference fixture projection.

Use pinned Smarty lexer/parser sources and `test/reference.php`; use
`test/full-engine.php` for controlled full-compiler or render checks. The
recorder bypasses plugin execution and compiler block validation and does not
prove argument values or precedence. Never render application templates for this
syntax task. Add minimized pinned-source examples to `smarty-reference.txt`
when available, with provenance. Edit grammar/scanner sources and regenerate;
never hand-edit generated parser files or vendored Smarty.

Run `npm test`, including existing mutation checks. Compare full fresh and
incremental snapshots for the edits above. Update the contract, feature row,
composition evidence for verified pairs only, and task status/evidence. Review
editor query impacts for new/changed named nodes without expanding into an
unrelated editor redesign.

Save hash-matched before/after corpus JSON outside `build/`. Report the fixed
`corpus/application/`, upstream core and upstream demo separately. Also rerun
current `../b3-app/fbs` and `../b3-app/hdb` as separate roots if available; they
are not the fixed application corpus. Inspect explicit structure in newly
clean files and changed trees, report remaining errors and regressions, and do
not count swallowed syntax as progress. If a root is absent, say so. Tests and
local reports do not replace independent review.

## Implementation evidence 2026-10-17

The hand-authored corpus adds 16 ternary cases across the HDB witness,
arithmetic and literal operands, comparison/word-boolean precedence, both
parenthesized nesting directions, assignments, if conditions, generic-tag
attributes, function/method arguments, modifier input/argument groupings,
indices, and array keys/values. A minimized pinned-source tree for the HDB
witness is also in `smarty-reference.txt`. The Node checks compare every valid
case with the recorder, probe controlled full-engine renders, assert the PHP 8
unparenthesized-chain limitation through compile-only mode, check malformed
recovery and block siblings, and compare incremental snapshots after adding,
deleting, and restoring ternary delimiters. Both highlight-query copies now
capture `?` as `@operator`; `tree-sitter query` confirms the capture on a
minimized ternary source.

The brief's original direct modifier-argument path was corrected from executed
Smarty evidence. For `{$x|cat:$a ? $b : $c}`, the parser tree has the complete
modifier expression as `ternary_expression.condition`; the full engine renders
`C` with `x=''`, `a=0` and `B` with `x='X'`, `a=0`. Parentheses in
`{$x|cat:($a ? $b : $c)}` put the ternary under
`modifier_expression.argument.parenthesized_expression` and render `XC` for
`x='X'`, `a=0`, `c='C'`. The task-creation reviewer and a separate targeted
implementation reviewer accepted this correction without findings. The short
array spelling is used for structural array key/value coverage to keep the
array-literal shape explicit.

Pinned Smarty 5.8.4 recorder and full-compiler probes accept `{$a ?: $b}` and
`{$a ?? $b}`; these are valid but remain deferred syntax gaps. Smarty also
accepts unparenthesized alternate-nested ternary source in the recorder and
compiler. Its generated PHP fails at render time under PHP 8, so the test only
asserts compile acceptance and does not assert runtime association. Explicitly
parenthesized nesting in either arm compiles and renders.

The required `npm test` exited 0 with 471 expected trees, 632/632 Node checks,
and 24/24 deliberate mutation checks caught, including the new mutation that
removes the ternary condition field. The captured log is
`/tmp/smarty-task051-npm-test.log`. No existing expected trees were changed.
The query check was `tree-sitter query queries/smarty_v5/highlights.scm
/tmp/smarty-051-query.tpl -p .`; it captures `?` as `operator` and `:` as
`punctuation.delimiter`.

Five separate before/after reports were generated outside `build/`. Before
reports used parser hash `3c9509226c6180e534dacf5c6de90aeaf8e745c26a2c9d274de928e66f1bf42a`;
all after reports used `bd8f6ad45da345d10768905a9c59a9299228d541b372de986245b6697ce8c846`.
The FBS, fixed application, upstream core, and upstream demo file hashes all
match pairwise; HDB's ternary witness hash also matches. One unrelated HDB file,
`src/app/templates/sncb/view_sap/view_sap_main.tpl`, changed during the run
(`7043453b...` before, `d01d2e9f...` after), so the full HDB file set is not
hash-matched and that whole-root comparison is reported with this limitation.
No templates were changed by this task. The separate corpus results are:

| Root | Before | After | Newly clean files |
| --- | --- | --- | --- |
| Fixed application | 467/467 | 467/467 | None |
| Upstream Smarty 5.8.4 core | 33/33 | 33/33 | None |
| Upstream demo | 1/1 | 1/1 | None |
| `../b3-app/fbs` | 201/201 | 201/201 | None |
| `../b3-app/hdb` | 471/472 | 472/472 | `src/app/templates/sncb/view_admin/users/view_user_rights_in_group.tpl` |

The newly clean HDB witness now has no error and contains one explicit ternary:
its condition is a comparison `binary_expression` with `$group_id` and unary
`-1`, followed by separate `$main_group_id` consequence and `$group_id`
alternative variables. No corpus file regressed; the only count change is the
HDB witness. The parser remains partial. Shorthand `?:` and `??` still need
separate bounded work. Independent implementation review accepted the task
with no actionable findings. The reviewer verified the trees and context
ownership, Smarty probes, recovery and edits, query captures, serial test and
mutation results, corpus gains, and the disclosed HDB file-hash caveat.

Before/after JSON reports and their SHA-256 digests:

| Root | Before report | After report |
| --- | --- | --- |
| Application | `/tmp/smarty-051-before-application.json` (`e7867a950140d41c233b607797d4b282454735f733b38962a5d2c1b631b2dddb`) | `/tmp/smarty-051-after-application.json` (`e53c2d2c879c9c50e6316d1b21d009706b58d660f30d1d6b5afc91bc1e3070b5`) |
| Upstream core | `/tmp/smarty-051-before-core.json` (`f9b0cc1a9ebdf8cb65d83c579614d30be12f1ae63da50ac587c7e4cf9ab5e7fc`) | `/tmp/smarty-051-after-core.json` (`0565214263540c850f21b0336be53c138a81bc9a05d40ad10e9939388ee0e985`) |
| Upstream demo | `/tmp/smarty-051-before-demo.json` (`6da2189d12dd281f697dee48f8d1fe2ecc6d9f516f401f55297e96591ed5bfa3`) | `/tmp/smarty-051-after-demo.json` (`b79de3bca72d4f08623dd558611c142b5353043ca7a71100c7ba8920ef9276dd`) |
| FBS | `/tmp/smarty-051-before-fbs.json` (`326050b7b10178a838e46c7593ec7180276453577a888db2afa4c61cff38906c`) | `/tmp/smarty-051-after-fbs.json` (`a22e1e373c1ce47da2d44dd79476db5303fa880948738e3c1ba040ac602d6d44`) |
| HDB | `/tmp/smarty-051-before-hdb.json` (`81e53cbbe79df671d935d1cecb585ac2cdc74694afb2d30d67512f89614cd848`) | `/tmp/smarty-051-after-hdb.json` (`cf3deb9b40e831ca38dda95483a2c50ec4076da36c66de950ac8186b8f3ce6df`) |
