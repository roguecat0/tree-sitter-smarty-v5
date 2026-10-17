# 048 — Namespace-qualified static method calls

**Status:** complete (2026-10-17); brief and implementation reviews accepted.
**Type:** standard Smarty syntax gap.
**Dependencies:** 009, 019.

## Motivation and confirmed witness

FBS `index.tpl:10` contains a namespace-qualified static call in an import map.
The original application class compiled without loading or invoking the class.
Use a neutral namespace in tracked fixtures:

```smarty
{Demo\Assets\Builder::build()}
```

## Bounded scope and proposed tree contract

Extend `static_method_call_expression.class` to a `qualified_name` node for
backslash-separated static class names, preserving component identifiers and
separator ranges. Keep existing unqualified `class: identifier`, `method` and
ordered `argument` fields unchanged. Smarty 5.8.4 accepts one or more complete
namespace segments, with or without one leading root backslash, including the shortest rooted one-segment call
`{\Demo::build()}`. Segment spelling
and case are preserved. Contextual names including `if`, `true`, `null`, `self`,
and `parent` are valid namespace segments; method names may also be contextual
words such as `for`. Each namespace segment follows Smarty's namespace ID
pattern: optional leading digits followed by a letter or underscore and then
letters, digits or underscores. This permits `1Demo\Assets`, `Demo\2Assets`,
and rooted `\1Demo\2Assets` without broadening ordinary identifiers. A
schematic unrooted tree is:

```text
(source_file
  (output
    value: (static_method_call_expression
      class: (qualified_name
        (identifier)
        (identifier)
        (identifier))
      method: (identifier))))
```

The `qualified_name` range includes namespace separators and, when present, the
leading root separator. `::` must be adjacent to the class name and method name;
whitespace before the method's `(` is accepted. Whitespace within/before a
namespace separator, repeated separators, and a trailing namespace separator
do not form a qualified call. Whitespace before a separator such as
`{Demo \Assets::build()}` can instead tokenize as a generic `Demo` tag with an
argument, which the recorder accepts but full compilation rejects without a plugin.
Keep these parser-boundary cases distinct from forms that Smarty itself rejects. An example
accepted by Smarty's parser and full compiler without class loading is
`{Demo\Assets::build ()}`.

Namespaced standalone functions, dynamic receivers, static properties and
method-result chains are separate gaps. Do not broaden generic tag names or
identifiers globally. Smarty also accepts namespaced standalone constants
(`{Demo\Assets\VERSION}`), namespaced class constants
(`{Demo\Assets\Builder::VERSION}`), and rooted class constants
(`{\Demo\Assets::VERSION}`). Namespaced constants remain a separate known
standard-syntax gap in this task. Preserve their distinct constant/call boundary:
do not parse them as `static_method_call_expression` or swallow a following
output. Keep the existing unqualified `Thing::READY` class-constant tree as a
regression.

## Failing-first trees, composition, recovery and edits

- Specify output trees for rooted and unrooted qualified names, zero/multiple
  call arguments, contextual and digit-prefixed segments, and qualified-name source ranges; retain
  unqualified calls and `Thing::READY` as regressions.
- Pin accepted `{Demo\Assets::build ()}` and rejected separator spacing, repeated
  separator and trailing-separator boundaries. Also pin a namespaced standalone
  and class constant as explicit separate syntax gaps with real parser errors and
  recognizable later output; Smarty accepts them but this task does not parse
  them. Do not let call recovery reinterpret a constant as a call.
- Probe assignment RHS, conditions, foreach source, generic-tag positional/named
  values, function/method arguments, modifier input/argument, bracket indices and
  array values. Add representative trees for output, condition, tag attribute,
  nested call and direct modifier argument so an accepted call cannot split into
  a constant plus a positional argument.
- Compile neutral namespace examples without rendering; class existence and
  runtime autoloading are not syntax assertions. For generic custom-tag values,
  use the recording parser to verify that a qualified call remains one attribute
  or positional expression; the full compiler rejects unknown `widget` tags
  unless a plugin is registered, which is outside this task.
- Check empty/trailing namespace segments, missing method/parenthesis and malformed
  argument recovery with separate later output.
- Edit an unqualified receiver into a qualified one, break/restore a separator,
  and remove/restore `::`. Mutation coverage should protect the class-field and
  whole-call ownership if a lexical fallback could hide a broken implementation.

## Implementation and completion gate

Before implementation, read `test/CONTRACT.md`, `docs/expanding.md` and
`docs/composition.md`. Add manually specified trees in `test/corpus/namespaced-static-method-calls.txt`
and a failing check in `test/namespaced-static-method-calls.test.mjs`; explicitly opt valid fixtures into
`fixtures('namespaced-static-method-calls.txt')`. Confirm the intended failure before changing grammar.
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

The `qualified_name` receiver is supported only inside
`static_method_call_expression.class`. Its identifier segments and separator
span preserve the full rooted/unrooted receiver range; immediate tokens enforce
separator adjacency. The implementation covers one rooted segment, multiple
segments, contextual names (including mixed case), digit-prefixed segments in
first and later positions, and all previously audited static-call expression
contexts. It leaves class-constant and standalone
constant productions unchanged.

Pinned Smarty 5.8.4 source has the `namespace` lexer pattern in
`vendor/smarty/smarty/src/Lexer/TemplateLexer.plex:286` and routes static class
access through `ns1` and `static_class_access` in
`vendor/smarty/smarty/src/Parser/TemplateParser.y:834`. The reference adapter
accepts every valid fixture in `fixtures('namespaced-static-method-calls.txt')`.
The controlled full compiler accepts the neutral unrooted, rooted one-segment,
contextual-word, and digit-prefixed-segment examples without rendering or
loading those classes. Hand-authored trees pin digit-prefixed first and later
segments, including the rooted form; the reference fixture records all three
as output events. It
rejects the whitespace-before-separator generic `Demo` tag without a plugin;
the recorder's acceptance there is only a tag/argument projection.

The existing negative assertion for `{\App\Thing::make($x)}` in
`static-class-method-calls.test.mjs` was corrected after both the pinned
recorder and full compiler accepted the rooted namespace form. New explicit
trees cover the qualified class field and composition; no existing expected
tree was rewritten.

Acceptance evidence: `npm test` passed: 435/435 Tree-sitter corpus cases,
589/589 Node tests, and all 21 isolated mutation checks were caught. It also
regenerated and rebuilt the parser. The mutation that removes `qualified_name`
from the static call's class choice is caught by the hand-authored
digit-prefixed receiver tree, protecting against a split into a generic tag and
a rooted call argument.

Fresh and incremental full snapshots match for edits from unqualified to
qualified receiver, repeated-separator break/restore, and `::` break/restore.
Malformed repeated/trailing separator, missing method, and missing closer
inputs retain a distinct later output. Separator whitespace is pinned on both
sides: `{Demo \\Assets::build()}` can be a recorder-accepted generic tag with
one positional call, while whitespace after `\\` or before `::` remains a
parse error. Namespaced standalone constants and namespaced class constants
remain explicit errors, distinct from static method calls.

Hash-matched local reports were saved outside `build/`:

| Separate corpus root | Before | After | Result |
| --- | ---: | ---: | --- |
| Fixed `corpus/application/` | 467 clean / 467 | 467 clean / 467 | No change; zero errors. |
| Upstream Smarty core | 33 clean / 33 | 33 clean / 33 | No change; zero errors. |
| Upstream Smarty demo | 1 clean / 1 | 1 clean / 1 | No change; zero errors. |
| FBS | 197 clean / 201 | 198 clean / 201 | `src/app/templates/sncb/index.tpl` became clean. |
| HDB | 470 clean / 472 | 470 clean / 472 | No change. |

All source file hashes matched in each before/after pair. The reports used
grammar hashes `641ed512e29b9da6b5f2c918725991148a2ab86a54c24a117997ef537ac4fe48`
before and `a2da0b8ab8cce5339a72a4df6ac96632af4fd5fc132f5bdfd56cb32ccd1c604f`
after. Locations: `/tmp/smarty-048-before-application.json` and
`/tmp/smarty-048-digit-after-application.json`; corresponding `upstream-core`,
`upstream-example`, `fbs`, and `hdb` filenames use the same prefix/suffix.
Structural inspection of newly clean FBS `index.tpl` confirmed the line-10
output owns `static_method_call_expression`; its class field is the complete
`b3\\Libs\\Asset\\CacheBuster` `qualified_name`, and its method field is
`build_importmap`.

Remaining failures in FBS are `view_actions/edit_action.tpl` (braced modifier
argument), `view_incident_report/change_owner.tpl` (`nofilter`), and vendored
Smarty `debug.tpl` (`nofilter`). HDB retains `view_admin/users/view_user_rights_in_group.tpl`
(ternary expression) and vendored `debug.tpl` (`nofilter`). These are outside
Task 048 and remain visible in the separate reports. The fixed local application
corpus and both upstream roots remain error-free; those counts do not imply
reviewed structure for every file.

## Independent implementation review

The reviewer found that Smarty permits digit-prefixed segments within namespace
receivers, which the first implementation could split into a generic tag plus
a separate call or reject. The accepted fix scopes the digit-prefixed ID form
to qualified-name segments, with hand-authored trees for first, later and
rooted digit-prefixed names. Recorder and full-compiler checks accept all three;
the reviewer confirmed complete receiver ownership and a mutation that catches
regression. Final review accepted composition, recovery, incremental edits,
generated sources, corpus hashes and the implementation evidence above.
