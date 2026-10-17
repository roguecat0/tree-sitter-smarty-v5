# 050 — Output `nofilter` suffix

**Status:** complete (2026-10-17).
**Type:** standard Smarty syntax gap.
**Dependencies:** 042.

## Motivation and confirmed witness

FBS `view_incident_report/change_owner.tpl:27` uses a method-call output with
`nofilter`. Both roots also contain the vendored
`src/classes/vendor/smarty/smarty/src/debug.tpl`, with seven `nofilter` outputs
each. Do not modify those vendored templates.

```smarty
{$value nofilter}
```

## Bounded scope and proposed tree contract

Support trailing `nofilter` on currently supported expression outputs using a
direct `attribute(name: identifier)` child, parallel to output `nocache`.
`output.value` continues to own the entire expression/modifier chain. Preserve
suffix spelling/range and source order when composed with `nocache`.

The pinned Smarty 5.8.4 `PrintExpressionCompiler` declares both `nocache` and
`nofilter` as option flags. Its `AttributeCompiler` recognizes option names
case-sensitively: the compiler-valid spelling is exact lowercase `nofilter`.
For valued flags it accepts only `true`, `false`, `1`, or `0`, with or without
quotes. Controlled full-engine checks confirm that `{$x nofilter}` and repeated
or mixed lowercase `nofilter`/`nocache` flags compile, while `{$x NoFilter}`
and `{$x nofilter=$flag}` fail compiler validation. These are compiler
boundaries, not Tree-sitter error rules: preserve any syntactically supported
case spelling or valued expression as an `attribute` tree rather than claiming
the parser must reject it. In particular, a parsed value remains under
`attribute.value` even when the compiler rejects its value. Do not infer
`nofilter` runtime behavior from syntax acceptance. `assign`, arbitrary output
attributes, escaping policy and runtime filtering behavior remain separate
concerns.

Hand-written target shapes (identifier spelling/ranges are preserved):

```text
{$x nofilter}
(output
  value: (variable name: (identifier))
  (attribute name: (identifier)))

{$x nofilter=true nocache=false}
(output
  value: (variable name: (identifier))
  (attribute name: (identifier) value: (boolean))
  (attribute name: (identifier) value: (boolean)))
```

The second tree fixes direct-child ownership and source order for valued and
mixed suffixes. Add a valued non-boolean expression case such as
`{$x nofilter=$flag}` with `attribute.value: (variable ...)`; this tree records
syntax and must not be labeled compiler-valid or parser-invalid based on the
compiler failure. If repeated flags are included, retain one ordered
`attribute` child per occurrence, as for `nocache`.

## Failing-first trees, composition, recovery and edits

- Pin simple, modifier, indexed, method-call, compound and built-in function
  outputs; check exact direct-child suffix ownership and following output.
- Compose inside nested if/foreach blocks and next to a generic tag. Probe
  `{widget nofilter}` and `{widget nofilter=$flag}` to preserve ordinary generic
  tag interpretation; suffix support must not change generic names/arguments.
- Pin the simple and valued/mixed tree sketches above. Check exact lowercase
  compiler-valid forms, accepted flag values (quoted and unquoted), repeated
  and mixed order, and case/value failures with the full compiler. Keep those
  compiler failures distinct from parser recovery assertions; preserve
  syntactically parseable valued forms as `attribute` nodes.
- Test unfinished `nofilter=`, an invalid extra suffix and a modifier following
  the suffix, after observing which forms Smarty actually rejects. Require real
  errors only for syntax-invalid cases and keep later output independent.
- Edit the suffix on/off and across a malformed boundary; compare full incremental
  snapshots. Reuse output-attribute regression/mutation checks where appropriate.

## Implementation and completion gate

Before implementation, read `test/CONTRACT.md`, `docs/expanding.md` and
`docs/composition.md`. Add manually specified trees in `test/corpus/output-nofilter.txt`
and a failing check in `test/output-nofilter.test.mjs`; explicitly opt valid fixtures into
`fixtures('output-nofilter.txt')`. Confirm the intended failure before changing grammar.
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

The hand-authored corpus adds eight cases for simple/following output,
modifier/index/method values, ordered mixed suffixes, parseable case/wider
values, built-in function output and a separate nested if/foreach output,
generic-tag arguments,
and an unfinished valued suffix. `test/output-nofilter.test.mjs` adds exact
ownership/range, compiler, reference, malformed recovery, and incremental
checks. The Node tests failed before the grammar change on the simple nofilter
output (`/tmp/smarty-task050-failing-node.log`), reproducing the audit witness.

`grammar.js` now routes the shared output suffix through one ordered `attribute`
rule; `src/scanner.c` recognizes `nocache` and `nofilter` through the shared
case-preserving output-attribute token. No public node names or fields changed.
The existing nocache test now leaves only arbitrary attributes outside the
supported suffixes. This expectation change follows the pinned full compiler:
exact-lowercase nofilter and nocache/nofilter flag values `true`, `false`, `1`,
and `0` compile quoted or unquoted; repeated and mixed lowercase flags compile.
Case variants such as `NoFilter`, a wider `nofilter=$flag` expression, an
arbitrary `foo=1` suffix, and a modifier after nofilter are compiler errors.
The parser preserves case variants and wider values as syntax, while malformed
`nofilter=` and unsupported extra attributes produce parse errors and retain a
separate later output. The recording adapter accepts broad syntax and is used
only for its limited parse/event projection. Runtime filtering is not inferred.

The acceptance run `npm test` passed: 454 expected trees, 609/609 Node checks,
and 22/22 deliberate mutation checks caught, including the new nofilter-path
mutation. The captured log is `/tmp/smarty-task050-npm-test-r3.log`. No existing
expected trees were changed; only a legacy Node assertion was narrowed because
the newly supported suffix is no longer an unsupported attribute.

Five independent before/after reports are saved outside `build/`. All 467
application, 33 upstream core, 1 upstream demo, 201 FBS, and 472 HDB template
hashes match between the corresponding reports. The before reports used parser
SHA-256 `15d9f8f9fba4aa5db57bdc9327154d6547eb0f183c78dabeb3ebf3eb596ef6e8`;
all after reports match the generated `src/parser.c` SHA-256
`3c9509226c6180e534dacf5c6de90aeaf8e745c26a2c9d274de928e66f1bf42a`.
No file regressed. The separate corpus results are:

| Root | Before | After | Newly clean files |
| --- | --- | --- | --- |
| Fixed application | 467/467 | 467/467 | None |
| Upstream Smarty 5.8.4 core | 33/33 | 33/33 | None |
| Upstream demo | 1/1 | 1/1 | None |
| `../b3-app/fbs` | 199/201 | 201/201 | `src/app/templates/sncb/view_incident_report/change_owner.tpl`; `src/classes/vendor/smarty/smarty/src/debug.tpl` |
| `../b3-app/hdb` | 470/472 | 471/472 | `src/classes/vendor/smarty/smarty/src/debug.tpl` |

The remaining HDB failure is
`src/app/templates/sncb/view_admin/users/view_user_rights_in_group.tpl:75`,
where the ternary expression remains a separate Task 051 gap. Structural
inspection confirms that `change_owner.tpl` owns the full method call in
`output.value` with a direct bare nofilter attribute. The newly clean debug
template has nofilter as a direct child of each modifier output; its variable,
index, modifier and surrounding block structures remain explicit. The FBS and
HDB copies of the vendored debug template were inspected without modifying
either copy. Existing editor queries require no change because the implementation
reuses the existing `attribute` node.

Reports (before JSON SHA-256, after JSON SHA-256):

| Root | Before report | After report |
| --- | --- | --- |
| Application | `/tmp/smarty-task050-before-application.json` (`02d66041d3a99912b6989a5dec54eb213a909c22a2b372eeb400139cf268fc0f`) | `/tmp/smarty-task050-after-application.json` (`e7867a950140d41c233b607797d4b282454735f733b38962a5d2c1b631b2dddb`) |
| Upstream core | `/tmp/smarty-task050-before-core.json` (`3dbb34f6ff3e7ade10ace5f301e1762dac77eefb1ac55e28274fcf489f15ce54`) | `/tmp/smarty-task050-after-core.json` (`f9b0cc1a9ebdf8cb65d83c579614d30be12f1ae63da50ac587c7e4cf9ab5e7fc`) |
| Upstream demo | `/tmp/smarty-task050-before-demo.json` (`1e301291a66c90f8801f32d474301f9fd17270bfcaa8cb10391551cc1e57ddd8`) | `/tmp/smarty-task050-after-demo.json` (`6da2189d12dd281f697dee48f8d1fe2ecc6d9f516f401f55297e96591ed5bfa3`) |
| FBS | `/tmp/smarty-task050-before-fbs.json` (`879a7d336b2a36e24df9467929c878a3191528c17d3f45debb420ba23d135441`) | `/tmp/smarty-task050-after-fbs.json` (`326050b7b10178a838e46c7593ec7180276453577a888db2afa4c61cff38906c`) |
| HDB | `/tmp/smarty-task050-before-hdb.json` (`e5d19c634e69a27735136857c54b1e81787734030790931ca3235e01347240e6`) | `/tmp/smarty-task050-after-hdb.json` (`81e53cbbe79df671d935d1cecb585ac2cdc74694afb2d30d67512f89614cd848`) |

Independent implementation review accepted the task with no actionable findings.
The reviewer verified suffix ownership/order, compiler boundaries,
generic-tag preservation, recovery and incremental checks, the serial
`npm test` result (454 corpus trees, 609 Node checks and 23 caught mutations),
and all five hash-matched corpus report pairs.
