# 047 — Smarty tags inside double-quoted attribute values

**Status:** complete (2026-10-17); brief and implementation reviews accepted.
**Type:** standard Smarty syntax gap.
**Dependencies:** 020, 037.

## Motivation and confirmed witness

FBS `edit_fb/edit_accident.tpl:19`, `search_widget/search_fb.tpl:156,164`,
and `view_fb/processing_exp_accident.tpl:43` place conditionals inside quoted
custom-tag attributes. These are three failing files, not ordinary HTML
attribute interpolation (which already allows outer Smarty blocks).

```smarty
{html_options options=$options selected="{if $a}1{else}0{/if}"}
```

## Bounded scope and proposed tree contract

Extend double-quoted interpolation to retain structured supported Smarty tags
and nested if blocks within the quoted value. The expected minimized tree is:

```text
(source_file
  (custom_tag
    name: (identifier)
    (attribute
      name: (identifier)
      value: (interpolated_string
        (string_interpolation
          value: (if_block
            (if_tag condition: (variable name: (identifier)))
            (text)
            (else_clause (else_tag) (text))
            (if_close_tag)))))))
```

For a value containing prefix/suffix text and an existing variable interpolation,
keep each literal run as a `string_fragment` sibling and each interpolation as a
`string_interpolation(value: ...)` child in source order. The quoted value owns
`interpolated_string`; that node's block interpolation owns `if_block`, and the
block keeps its regular condition/body/branch/closer nodes. Preserve exact quote
and brace ranges, existing expression interpolation shapes, and plain `string`
nodes.

The pinned parser has a dedicated `doublequotedcontent ::= smartytag`
production. Preserve unknown opening/closing tags independently when accepted
inside quoted values; do not infer plugin block pairing. Smarty 5.8.4 treats
`{literal}` and `{/literal}` inside a double-quoted string as ordinary text
fragments, but still recognizes subsequent `{if ...}` and `{/if}` tags there.
The markers do not make the rest of the string opaque. Comments are rejected in
this context: `{html_options selected="x{* c *}y"}` raises a compiler syntax
error. Keep that form an explicit error/recovery case; do not absorb it as a raw
string. Arbitrary template evaluation, alternate delimiters and new built-in
block families are outside this task.

## Failing-first trees, composition, recovery and edits

- Pin the minimized conditional and a value with prefix/suffix text, existing
  variable interpolation and nested if/else blocks. Verify all child fields.
- Check the same string form in output, named/positional custom-tag values,
  function/method arguments and modifier arguments using recorder probes first.
  Add representative trees for accepted shared-string contexts, not a blanket
  claim about every composition cell.
- Pin the expected tree above plus prefix/suffix fragments and an existing
  variable interpolation. Add a separate tree for `{literal}` markers remaining
  string fragments around a recognized nested `{if}` block.
- Verify comments inside the quoted value are rejected by recorder and compiler
  and produce a genuine localized Tree-sitter error with later tag/output
  preserved. Do not swallow the invalid source as a raw `string`.
- Probe single quotes, escaped quotes/braces and nested quotes, then specify
  accepted forms using manual trees; escaped quotes and tested nested quote
  examples compile in Smarty. Keep case-sensitive string boundaries explicit.
- Test missing inner `{/if}`, missing outer quote, malformed condition and an
  adjacent later tag/output. Preserve useful recovery and distinguish inner and
  outer delimiters.
- Edit a plain quoted value into a conditional, remove/restore its closer and
  outer quote. Extend scanner mutation checks if a new mode transition is added.

## Implementation and completion gate

Before implementation, read `test/CONTRACT.md`, `docs/expanding.md` and
`docs/composition.md`. Add manually specified trees in `test/corpus/tags-in-quoted-attributes.txt`
and a failing check in `test/tags-in-quoted-attributes.test.mjs`; explicitly opt valid fixtures into
`fixtures('tags-in-quoted-attributes.txt')`. Confirm the intended failure before changing grammar.
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

## Implementation evidence (2026-10-17)

The quoted string interpolation now retains recognized `if_block`, generic
opening/closing tags, and assignment tags under `string_interpolation(value)`.
Twelve hand-written valid fixtures cover the confirmed conditional tree, literal
fragments and variables around nested conditionals, nested `if`/`else`, output,
named and positional generic-tag values, function and method arguments,
modifier input, escaped quotes/braces, single-quoted non-interpolation, nested
quoted output inside a conditional, and independent unknown opening/closing
tags. All twelve fixtures pass the pinned recorder's acceptance check. Its
event projection omits the nested output event in the nested-output fixture;
the hand-written tree pins that output shape, while the comparison checks the
remaining recorder events. Full Smarty 5.8.4 compilation accepts the built-in
`html_options` witness, output, function/method arguments, and the escaped-quote,
escaped-brace, and nested-output cases. Arbitrary unknown-plugin compilation
remains out of scope.

Smarty rejects a comment opener inside a quoted value. For the minimized source
`{html_options selected="x{* c *}y"}`, both the recorder and full compiler report
`Unexpected "* "` and emit no recorder events. The old parser-only tree was
`(source_file (custom_tag name: (identifier) (attribute name: (identifier) value: (string))))`;
the new expected tree is
`(source_file (ERROR (identifier) (identifier) (string_fragment) (ERROR) (string_fragment)))`.
This corrects the former expectation that the invalid value remained a normal
string. A marker-local scanner token and a regular-language exclusion in the
plain string token keep this error out of valid string syntax; tests also pin
that the Task 020 interpolation trees and existing malformed recovery shapes
remain unchanged.

The comment rejection retains a following `{$after}` as a variable
interpolation under the root recovery `ERROR`; it does not recover that output
as a root-level `output` sibling. Missing nested closers, malformed conditions,
missing outer quotes, and an edit into a nested conditional have dedicated
checks. The malformed nested condition keeps its `if_block` and root-level
later output; the other broad-error recovery shapes are documented in the Node
test assertions.

The final captured `npm test` run exited 0: 583/583 tests passed and all 20
deliberate grammar mutations were caught. The exact captured log is
`/tmp/smarty-047-final2-npm-test.log`. Hash-matched, separate corpus reports
are saved outside `build/`:

| Root | Before clean / total | After clean / total | New clean files / regressions | Report |
| --- | ---: | ---: | --- | --- |
| Fixed `corpus/application/` | 467 / 467 | 467 / 467 | 0 / 0 | `/tmp/smarty-047-after-application.json` |
| Upstream Smarty 5.8.4 core | 33 / 33 | 33 / 33 | 0 / 0 | `/tmp/smarty-047-after-upstream-core.json` |
| Upstream Smarty 5.8.4 demo | 1 / 1 | 1 / 1 | 0 / 0 | `/tmp/smarty-047-after-upstream-demo.json` |
| `../b3-app/fbs` | 186 / 201 | 197 / 201 | 11 / 0 | `/tmp/smarty-047-after-fbs.json` |
| `../b3-app/hdb` | 470 / 472 | 470 / 472 | 0 / 0 | `/tmp/smarty-047-after-hdb.json` |

Every source-file hash matched its before report. The before parser hash was
`74f9cdb118613c726870ea180f5c79fe88134315d9a64681cee83ee66d3c31b0`; the after
parser hash was `641ed512e29b9da6b5f2c918725991148a2ab86a54c24a117997ef537ac4fe48`.
The three Task 047 witnesses (`edit_fb/edit_accident.tpl`,
`search_widget/search_fb.tpl`, and `view_fb/processing_exp_accident.tpl`) are
among the eleven newly clean FBS files. Structural inspection confirms each
quoted value contains `interpolated_string > string_interpolation > if_block`
with condition, body, branch and closing nodes. The other eight newly clean FBS
files contain the reviewed `elseif_clause` structures from Task 046; no syntax
was swallowed. The remaining four FBS errors are in `index.tpl`,
`view_actions/edit_action.tpl`, `view_incident_report/change_owner.tpl`, and the
vendored Smarty `debug.tpl`. HDB remains at two errors: the user-rights template
and vendored `debug.tpl`. The fixed application corpus and both separate
upstream roots remain clean.

The task completion reviewer requested hand trees for escaped braces and nested
inner quotes; both were added and validated against the pinned recorder and full
compiler. The reviewer then accepted the tree ownership, compiler boundaries,
recovery, hash-matched corpus results, and final `npm test` run. The source report
shows no parse-error regressions. See the [current-template audit](../features.md#current-fbshdb-audit-2026-10-17)
for the broader gap map.

## Independent implementation review

The reviewer independently confirmed that accepted tags retain their nested
structure, literal markers remain fragments while following tags stay active,
and a comment opener in a quoted value remains a real parser/compiler error.
After the requested escaped-brace and nested-inner-quote fixtures were added,
the reviewer accepted the implementation and checked the final captured gate,
corpus source hashes and structural trees in all eleven newly clean FBS files.
