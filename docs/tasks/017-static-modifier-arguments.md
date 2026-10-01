# 017 — Bare identifiers as modifier arguments

Status: complete (2026-10-01). Brief accepted after one revision round;
independent implementation review accepted with no actionable findings.
Dependencies: existing modifier chains and the expression/name token contract.
The task's corpus baseline report is `/tmp/smarty-017-before.json`, captured at
`65cfe9a`:
467 templates, 240 clean, 227 failing. Its `grammarSha256` field hashes the
generated `src/parser.c` (`829aa943ed57457b277c998f2e6478d4029e147282c925442e7df5dae08574b6`);
the separate `grammar.js` SHA-256 is
`84c1147d56823388f0853d6f1552f373844e773ff0a029e24b00e00b7939c251`.
The evidence is linked from the [composition matrix](../composition.md#ev-mod-id-arg).

## Motivation and corpus evidence

The hash-matched report contains 467 templates: 240 without parse errors and
227 with errors. A source scan finds 51 forms matching a modifier followed by a
colon and one static identifier, in 49 templates; all 49 templates currently
fail. Fifty of the 51 matches share a source line with a reported parse error.
This is correlational evidence, not proof that the argument causes every
template's failure. The remaining match is in `history.tpl`, whose template
has a parse error elsewhere.

For example,
`corpus/application/view_admin/action_types/search_action_type.tpl:90` contains
`{$app->urls['go_page']->get_url('page', 'var_page')|escape:quotes}`; its
reported error starts immediately before `quotes`. The same file's line 35
has `|escape:'quotes'`, a quoted string argument that is not part of this
cluster. The minimized `{$x|escape:quotes}` is accepted by the pinned Smarty
5.8.4 recording compiler; it records `escape` with one argument and an output
event. The same unquoted pattern occurs with names such as `DATEFORMAT` and
`htmlall`.

The pinned `vendor/smarty/smarty/src/Parser/TemplateParser.y` defines
`modparameter ::= COLON value` and `value ::= ID`; its action preserves a
defined constant or quotes an undefined name. The recording adapter exposes
modifier names and argument counts, not argument values or constant
resolution. The pinned lexer defines `ID` in
`vendor/smarty/smarty/src/Lexer/TemplateLexer.plex` as
`[0-9]*[a-zA-Z_]\w*`, so an identifier token can have a digit prefix when a
name character follows. A controlled Smarty 5.8.4 full-engine check for
`{$x|default:foo}` with an empty `x` renders `foo`, confirming that an
undefined identifier is usable as a literal value in that setup. This task's
tree contract records the source name, not whether a deployment defines a PHP
constant with that spelling.

Include the digit-prefixed `ID` form in this bounded modifier-argument context:
Smarty's pinned lexer and parser accept `{$x|default:123foo}`, the recorder
reports one modifier argument, and the full engine renders `123foo` when `x`
is empty. Preserve that token as an `identifier` node. Pure decimal values
remain `number` nodes. This form is not present in the current corpus; its
inclusion follows the pinned `ID` production rather than a corpus-frequency
claim.

Task 016's confirmed metadata-as-modifier-argument composition has no direct
`$x|modifier:$item@index` form in the 467 current templates. Keep
[016](016-loop-metadata-modifier-argument.md) visibly deferred and unreviewed;
it remains a separately confirmed gap, but this corpus-backed task has higher
priority.

## Scope and proposed tree

Permit one static Smarty `ID` token as a direct modifier argument, preserving
the ordinary `identifier` node and the repeated `argument` field. `ID` is
`[0-9]*[a-zA-Z_]\w*`; it can begin with digits only when a later name
character follows. Preserve exact token spelling:

```smarty
{$x|escape:quotes}
```

```text
(source_file
  (output value: (modifier_expression
    value: (variable name: (identifier))
    name: (identifier)
    argument: (identifier))))
```

The same tree shape applies to `{$x|default:123foo}` with argument text
`123foo`. A pure numeric argument such as `123` remains `(number)`.

```smarty
{$x|default:123foo}
```

```text
(source_file
  (output value: (modifier_expression
    value: (variable name: (identifier))
    name: (identifier)
    argument: (identifier))))
```

The identifier may compose with existing modifier chains and existing
argument forms. For example, `{$x|default:foo|escape:'htmlall'}` has nested
`modifier_expression` nodes: the inner expression's `argument` is
`(identifier)` `foo`; the outer expression's `argument` is `(string)`
`'htmlall'`. Preserve the modifier names, source spelling and nesting.

Limit the new form to a direct value after a modifier colon. Do not permit bare
identifiers as general expressions, ordinary generic-tag positional or
attribute values, array values/keys, function or method arguments, or any other
context. Do not add calls, namespaced identifiers, dynamic names, or runtime
constant resolution. Existing `true`, `false`, and `null` remain their current
literal nodes; `Class::NAME` remains a `class_constant_expression`; strings,
numbers, variables, and other currently supported modifier arguments retain
their existing tree shapes. A spelling that is a defined PHP constant may
have runtime meaning the syntax recorder cannot see; the identifier node only
preserves the source token.

## Acceptance checks to add first

1. Add the manual tree above and a Node check that verifies the argument is an
   `identifier` with text `quotes` and the exact source range. Add a reference
   check for the fixture; assert only the observable `escape` modifier and
   output events, not the argument value.
2. Add a hand-authored chained-modifier tree for
   `{$x|default:foo|escape:'htmlall'}`. Assert the inner bare identifier,
   outer string argument, modifier order/nesting and source ranges. Use a
   controlled full-engine case for `{$x|default:foo}` with empty `x` and assert
   Smarty 5.8.4 renders `foo`; do not infer universal constant resolution from
   that case.
3. Preserve existing classifications: add or reuse assertions that
   `{$x|m:true:false:null:Widget::NAME}` keeps boolean, null, and class-constant
   nodes, and that `{widget value=foo}` remains outside this task's supported
   generic-tag value subset. The latter grammar check must stay erroneous even
   though the Smarty recorder may accept that tag form.
4. Add the manual tree and a reference check for `{$x|default:123foo}`. Check
   the argument text and source range; the recorder observes one modifier
   argument, and a controlled full-engine check with empty `x` renders
   `123foo`.
5. Reject a missing argument (`{$x|m:}`) in both the parser and Smarty's
   compiler. Keep a malformed multi-token argument (`{$x|m:foo bar}`) outside
   this grammar subset and verify a following independent output or close tag
   remains recoverable. The current recording compiler reports no error for
   the multi-token spelling but records only one modifier argument, so do not
   claim the recorder establishes its token-level interpretation.
6. Check an incremental edit that changes a quoted modifier argument into a
   bare identifier, and compare its resulting snapshot with a fresh parse.
7. Run `npm test`; preserve before/after corpus reports outside `build/`, verify
   source hashes and grammar hash matching, inspect newly clean templates and
   report any remaining failures. Do not count parse cleanliness without
   structurally checking the new identifier argument nodes.

The recorder does not validate argument values, PHP constant resolution,
runtime modifier behavior, or plugin availability. It also cannot determine
how trailing unbraced text in the multi-token negative example is consumed.
Hand-authored trees establish the identifier structure; the controlled
full-engine fixture is limited to its specified `default:foo` rendering case.

## Brief-review disposition

Independent task-creation review accepted (2026-10-01) after one revision
round. The reviewer confirmed the corpus locations/counts, pinned Smarty
compiler and full-engine behavior for ordinary and digit-prefixed IDs, the
bounded modifier-only scope, and the separate composition-matrix cell. The
reviewer suggested relabeling the baseline report heading; that non-blocking
wording cleanup was applied before implementation.

## Implementation evidence

The grammar adds existing `identifier` only to the direct modifier-argument
choice and uses a second aliased token for Smarty IDs with a digit prefix. This
keeps the token out of generic tag values, function arguments, array values,
and ordinary expressions. Hand-written expected trees cover `quotes`,
`123foo`, chained modifiers, primitive/class-constant classifications, and a
pure number. The Node checks verify argument and modifier ranges, recorder
events, the two controlled full-engine render cases, excluded contexts,
missing/multi-token recovery, and a quoted-to-identifier incremental edit.

`npm test` passed at the final implementation: 147 expected trees, 222 Node
checks, and 11/11 mutation checks caught. Log: `/tmp/smarty-017-final-test.log`.
The post-change report is `/tmp/smarty-017-after.json`: 467 templates, 247
clean, 220 failing. Before and after reports have identical source-file hashes;
there are seven newly clean templates and no regressions. The generated parser
hash matches the after-report `grammarSha256` at
`d0a8515989bdeb5b9c629c822c68bc174d5f765d5d3e956000d2c93691df9a56`; the
implementation `grammar.js` hash is
`4f9601e778363842f3441a347c92be1e1186a512833c36c4edc9e1bb902008c5`.

Each newly clean tree was inspected. In every case the recovered expression
contains one `(identifier)` child in a `modifier_expression`'s repeated
`argument` field, with text `quotes`; the seven templates are
`view_admin/chemical_products/search_chemical_product.tpl`,
`view_admin/name_list_carriers/search_name_list_carrier.tpl`,
`view_admin/name_list_instructions/search_name_list_instruction.tpl`,
`view_admin/repair_kinds/search_repair_kind.tpl`,
`view_fabrication/view_fabs.tpl`, `view_labels/label_request_table.tpl`, and
`view_packaging/search_packaging.tpl`. The reference adapter observes one
modifier argument but does not validate its value or constant resolution.
The pinned full-engine checks cover only the empty-input `default:foo` and
`default:123foo` cases.

## Implementation-review disposition

Independent implementation review accepted (2026-10-01) with no actionable
findings. The reviewer reproduced `npm test` and the hash-matched corpus
comparison, verified generated sources, inspected all seven newly clean trees,
checked the identifier and number boundaries plus excluded contexts, and
confirmed the reference/runtime limitations and synchronized contract,
inventory, and composition evidence.

## Subsequent contract correction (Task 022)

Task 017's grammar-only negative for `{f(foo)}` and `{f(123foo)}` did not show
that Smarty rejects bare IDs in call arguments. The recording compiler accepts
`{f(foo)}` syntactically and emits a modifier event; the full compiler then
fails during unknown-modifier resolution because `f` is not installed. In
contrast, pinned Smarty 5.8.4's `function ::= ns1 OPENP variablelist CLOSEP`
and `variablelist ::= expr` productions accept a bare ID argument in
`{isset(foo)}` and `{in_array(foo, $list)}`. The latter full-engine example
renders `1` when `list` contains `foo`. The variable-callee form `{$f(foo)}`
is rejected at `(` with `Unexpected "("`. Task 022 promotes IDs as primary
expressions in tested call-argument contexts; the earlier grammar subset
boundary remains a record of Task 017's state, not the current contract.
