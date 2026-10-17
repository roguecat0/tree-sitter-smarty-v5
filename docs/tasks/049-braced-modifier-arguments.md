# 049 — Braced expressions in modifier arguments

**Status:** complete (2026-10-17).
**Type:** standard Smarty syntax gap.
**Dependencies:** 017, 037–039.

## Motivation and confirmed witness

FBS `view_actions/edit_action.tpl:160,168,181` contains `|cat:{$expr}`.
That file also needs Task 046; do not predict a clean-file gain from this task
alone.

```smarty
{"prefix"|cat:{$id}}
```

## Bounded scope and proposed tree contract

Accept a complete braced expression as a modifier argument. Reuse the existing
wrapper convention: `modifier_expression.argument` owns an `output` whose
`value` is the complete inner expression. Preserve both braces and the existing
modifier input/name/argument fields. Direct arguments retain their current tree.
Do not flatten the wrapper or include a later modifier in its inner expression.

For the minimized witness, the expected tree shape is:

```text
(source_file
  (output
    value: (modifier_expression
      value: (string)
      name: (identifier)
      argument: (output
        value: (variable name: (identifier))))))
```

The argument wrapper spans both inner braces; its `output.value` spans only the
inner expression. Assert these ranges and texts explicitly.

This is a modifier-argument boundary feature, not unrestricted braced expressions
in every primary position. Empty braces, nested full tags/blocks and output
attributes inside the wrapper require independent Smarty observations; accepted
forms outside the selected expression boundary remain documented follow-ups.

## Failing-first trees, composition, recovery and edits

- Pin the reduced example, multiple braced arguments, a following modifier
  chain, arithmetic and an inner modifier expression. Use manual trees to
  resolve inner-versus-outer modifier/colon ownership.
- Keep valid method and index operands as separate witnesses, such as
  `{$x->m($i)|cat:{$id}}` and `{$rows[$i]|cat:{$id}}`; Smarty rejects a chained
  method-then-index form such as `{$x->m()[0]}`. Do not use that rejected chain
  as a positive test.
- Compose modified values in output, generic-tag attributes, conditions, function
  arguments and array values. Probe ambiguous direct argument precedence before
  asserting acceptance; explicitly test the application-shaped method operand.
- Compare recorder modifier names/counts and output events, acknowledging that
  nested wrappers may affect the projection. Use actual compiler/render checks on
  controlled `cat` inputs to verify value grouping independently.
- Test missing inner expression/brace, duplicate colons and malformed operands.
  Keep a separate later output in the source and require it to remain
  recognizable; do not assert Smarty accepts a second output while the first
  outer modifier tag is malformed.
- Edit `|cat:$id` to `|cat:{$id}`, remove/restore the inner closing brace, and
  append an outer modifier. Consider a mutation of wrapper ownership.

## Implementation and completion gate

Before implementation, read `test/CONTRACT.md`, `docs/expanding.md` and
`docs/composition.md`. Add manually specified trees in `test/corpus/braced-modifier-arguments.txt`
and a failing check in `test/braced-modifier-arguments.test.mjs`; explicitly opt valid fixtures into
`fixtures('braced-modifier-arguments.txt')`. Confirm the intended failure before changing grammar.
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

## Implementation evidence

The implementation adds a modifier-argument-local braced-expression rule and
aliases it to the existing `output` node. The wrapper includes both braces;
`output.value` covers the inner expression. Existing direct arguments and
modifier input/name/argument fields retain their prior shapes. No new named
node was added, so the existing output and modifier editor captures continue to
apply; `queries/highlights.scm` and `queries/smarty_v5/highlights.scm` were
reviewed.

Hand-authored [corpus trees](../../test/corpus/braced-modifier-arguments.txt)
and [Node checks](../../test/braced-modifier-arguments.test.mjs) cover the
minimal witness, exact wrapper/value ranges, multiple arguments, a following
modifier, arithmetic precedence, an inner modifier, separate method and index
operands, the application-shaped chained method, and composition in a
generic-tag attribute, `if` condition, instance-method argument, and array
value. The range test fixes `modifier_expression` at `[1,19)`, the argument
wrapper at `[14,19)`, and its variable value at `[15,18)` for
`{"prefix"|cat:{$id}}`. Reference checks compare recorder events and counts,
without treating that projection as proof of tree ownership. Three controlled
full-engine renders produce `prefix42`, including arithmetic and a nested
modifier, directly checking `cat` value grouping. The compiler accepts the
condition, call, and array compositions; recorder evidence covers the unknown
generic tag because the full compiler cannot validate that application tag.

Malformed missing-brace, missing-expression, and duplicate-colon examples are
rejected by Smarty's recorder and compiler. Tree-sitter reports errors while
retaining a distinct error-free `{$after}` output descendant; the tests do not
claim that Smarty accepts another output after malformed input. Incremental
edits change `|cat:$id` to `|cat:{$id}`, remove and restore the inner close, and
append/remove `|escape`; each full incremental snapshot equals a fresh parse.
The mutation suite catches a wrapper-alias mutation. No old expected tree
changed.

`npm test` passed: grammar checking, all 442 corpus fixtures and 595 Node
checks, followed by all 20 grammar mutations. Focused Tree-sitter corpus,
braced-modifier Node checks, and `npm run check:grammar` also passed before the
full gate.

Before/after reports are hash-matched per template and stored outside `build/`:

| Root | Before | After | Report files |
| --- | --- | --- | --- |
| `corpus/application/` | 467/467 clean | 467/467 clean | `/tmp/smarty-task049-before-application.json`, `/tmp/smarty-task049-after-application.json` |
| `corpus/upstream-smarty-v5.8.4-core/` | 33/33 clean | 33/33 clean | `/tmp/smarty-task049-before-upstream-core.json`, `/tmp/smarty-task049-after-upstream-core.json` |
| `corpus/upstream-smarty-v5.8.4-example/` | 1/1 clean | 1/1 clean | `/tmp/smarty-task049-before-upstream-demo.json`, `/tmp/smarty-task049-after-upstream-demo.json` |
| `../b3-app/fbs/` | 198/201 clean | 199/201 clean | `/tmp/smarty-task049-before-fbs.json`, `/tmp/smarty-task049-after-fbs.json` |
| `../b3-app/hdb/` | 470/472 clean | 470/472 clean | `/tmp/smarty-task049-before-hdb.json`, `/tmp/smarty-task049-after-hdb.json` |

The parser source hash changed from
`a2da0b8ab8cce5339a72a4df6ac96632af4fd5fc132f5bdfd56cb32ccd1c604f` to
`15d9f8f9fba4aa5db57bdc9327154d6547eb0f183c78dabeb3ebf3eb596ef6e8`; all five
before/after pairs have identical source hashes. FBS's newly clean
`src/app/templates/sncb/view_actions/edit_action.tpl` has source hash
`d3f6e767ec81d687fcd7bca9809ad17115c495801bded3669a95987514fbf012`. Its
outputs at lines 160, 168, and 181 were structurally reviewed: they retain
modifier chains with braced `argument: output(value: method_call_expression)`
or `output(value: variable)` descendants. The FBS errors still visible are in
`view_incident_report/change_owner.tpl` and vendored `debug.tpl`; HDB's remain
in `view_admin/users/view_user_rights_in_group.tpl` and vendored `debug.tpl`.
Their error counts and source snippets are unchanged. The FBS/HDB report gains
are local to Task 049's braced arguments; other remaining gaps are tracked by
Tasks 050 and 051. No fixed or upstream corpus regression was observed.

Independent implementation review accepted the task with no actionable
findings. The reviewer verified the serial `npm test` exit status, all 595
Node checks and 21 caught mutations, hand-authored structure and edit checks,
the newly clean FBS tree, and all five hash-matched corpus report pairs.
