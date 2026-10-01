# 019 — Static class method calls

Status: complete (2026-10-01). Brief accepted after two revision rounds;
implementation review accepted after one revision. Priority: corpus task after
completed 018.
Dependencies: class-constant expressions (009) and ordinary method/function
calls (004, 011). Task 016 remains deferred; tasks 017 and 018 remain complete.

## Motivation and corpus evidence

The hash-matched report `/tmp/smarty-018-after.json` covers the fixed set of
467 application templates at grammar hash
`1658ac9955178f0bbfc0a99937a075836408bb2b51233caf75efc4388d5090c3`:
382 templates have no parse errors and 85 do. Auditing each failing template's
actual earliest error and nearby source, rather than the report's lexical
hints, found 17 failing templates whose earliest error is a static
`Class::method(...)` call. Representative first-error contexts include
enumerator calls in `view_admin/action_types/mapped_module_types_table.tpl`,
`view_module/full_instructions.tpl`, and `view_search/search_db.tpl`; a call in
an `if` condition in `view_certificate/actions_list.tpl`; a foreach source in
`view_admin/groups/edit_competence_level_dialog.tpl`; and a call embedded in a
JavaScript string in `view_action/create_action_type.tpl`. This is a first-error
cluster count, not a prediction that all 17 templates will become clean; later
errors may remain.

The 17 audited paths are `view_action/create_action_type.tpl`,
`view_action/edit_instruction_mapped_module_types_table.tpl`,
`view_admin/action_types/action_type_competence_levels_table.tpl`,
`view_admin/action_types/mapped_module_types_table.tpl`,
`view_admin/groups/edit_competence_level_dialog.tpl`,
`view_admin/module_types/add_action_type_dialog.tpl`,
`view_admin/module_types/mapped_actions_table.tpl`,
`view_admin/module_types/properties_table.tpl`,
`view_admin/module_types/sub_module_types_table.tpl`,
`view_admin/users/search_user.tpl`, `view_ajax/group_info.tpl`,
`view_certificate/actions_list.tpl`, `view_module/full_instructions.tpl`,
`view_module/instruction_summary.tpl`, `view_orders/nl_request_parent_table.tpl`,
`view_repair/edit_repair.tpl`, and `view_search/search_db.tpl`.

`view_admin/action_types/triggers_table.tpl` contains a later static enumerator
call, but its earliest error is the unsupported bare `GROUP_NAME_NORMAL`
expression in `$trigger->get_name(GROUP_NAME_NORMAL)`, so it is excluded from
the 17-file earliest-error count.

Minimized observations against the pinned Smarty 5.8.4 parser/compiler:

```smarty
{Thing::make($x)}
```

The recording adapter accepts this as one output expression, and the full
engine compiles `{DateTime::getLastErrors()}` without executing the call. The
current grammar reports an error inside the `class_constant_expression` and
does not represent the parentheses as part of the call. A more damaging
misclassification occurs in a generic-tag attribute:

```smarty
{widget value=Thing::make($x)}
```

The current grammar accepts this source but makes `Thing::make` the attribute
value and `$x` a separate positional argument. Smarty's recorder reports one
`widget` tag with one named argument `value` and no positional argument. Its
tag and argument names/counts expose that boundary; the hand-authored tree must
assert that the call and `$x` remain one expression.

Other reduced contexts are accepted by the recorder and rejected or
misclassified by the current grammar:

```smarty
{if Thing::isReady($x)}Y{/if}
{foreach Thing::items() as $item}{$item}{/foreach}
```

### Composition audit probes

To populate the expression-composition checklist, each of the 11 contexts in
the new `Static class method call` row of
[`docs/composition.md`](../composition.md#static-class-method-call-composition-audit)
was reduced and checked with the current Tree-sitter parser and the pinned
Smarty 5.8.4 recorder. The recorder returns no syntax error for every form; its
projection records tag names and ordered argument names/counts, plus
modifier/output events, but does not verify expression values or tree
structure. Current Tree-sitter reports errors in
output, condition, foreach source, function/method argument, modifier input,
modifier argument, bracket index, array key, and array value contexts. It parses
the generic-tag positional and attribute examples without an error but splits
the call into a class constant and a separate parenthesized argument, so those
two cells are structurally unsupported as well.

| Checklist context | Minimal positive Smarty observation | Current parser result |
| --- | --- | --- |
| Output | `{Thing::make($x)}` | Error inside class constant; argument is separate |
| Condition | `{if Thing::make($x)}Y{/if}` | Error inside class constant |
| Foreach source | `{foreach Thing::make($x) as $item}{$item}{/foreach}` | Error inside class constant |
| Generic-tag positional | `{widget Thing::make($x)}` | No error, but two arguments: class constant and parenthesized expression |
| Generic-tag attribute | `{widget value=Thing::make($x)}` | No error, but attribute value is class constant and call argument is a separate positional argument |
| Function/method argument | `{strlen(Thing::make($x))}` and `{$o->run(Thing::make($x))}` | Error inside class constant in both |
| Modifier input | `{Thing::make($x)|escape}` | Error inside class constant |
| Modifier argument | `{$x|default:Thing::make($x)}` | Error inside class constant |
| Bracket index | `{$a[Thing::make($x)]}` | Error inside class constant |
| Array key | `{[Thing::make($x)=>1]}` | Error inside class constant |
| Array value | `{[1=>Thing::make($x)]}` | Error inside class constant |

These probes confirm a valid syntax gap at every listed pairing. The planned
implementation's acceptance trees and reference checks must cover all 11 cells;
the reference projection checks tag names, ordered argument names/counts, and
modifier/output events but not expression values, while the trees establish
call ownership and fields.

Pinned source evidence is in Smarty 5.8.4
`vendor/smarty/smarty/src/Parser/TemplateParser.y`: `value ::= ns1 DOUBLECOLON
static_class_access` (around line 834),
`static_class_access ::= method` and `static_class_access ::= method objectchain`
(around lines 1248–1253), and `method ::= ID OPENP params CLOSEP` (around line
1170). The recording adapter verifies parser acceptance, tag names, ordered
argument names/counts, and modifier/output events. It does not inspect the
static class name, method name, or argument values; hand-authored trees must
establish the call node, field ownership, and argument structure. The full-engine
compile check establishes compilation, not runtime class registration, method
behavior, or returned values.

Two other confirmed gaps remain separately visible. The same manual audit found
17 first-error contexts with Smarty interpolation inside a double-quoted string,
including `action_types/action_value_add_child.tpl`,
`view_module/select_module.tpl`, and `view_repair/action_blocks.tpl`. It found
10 first errors at bitwise `&` conditions, including `messages.tpl`,
`view_charts/team_tos_table.tpl`, and `view_to/to_overview.tpl`. These are
earliest-error context counts, not universal syntax counts or task scope; they
need their own minimized contracts. Do not fold string interpolation, bitwise
operators, or other reported gaps into this task.

## Scope and proposed tree

Represent one unqualified static class method invocation as a primary
expression. Preserve the receiver and method as separate identifiers, the
`::` delimiter as anonymous syntax, and each supported ordinary expression
argument as a repeated `argument` field. The empty and one-argument examples
have these exact trees:

```smarty
{Thing::make()}
```

```text
(source_file
  (output
    value: (static_method_call_expression
      class: (identifier)
      method: (identifier))))
```

```smarty
{Thing::make($item->name, State::READY)}
```

```text
(source_file
  (output
    value: (static_method_call_expression
      class: (identifier)
      method: (identifier)
      argument: (member_expression
        object: (variable name: (identifier))
        member: (identifier))
      argument: (class_constant_expression
        class: (identifier)
        constant: (identifier)))))
```

The exact direct-tag argument composition is one call value, not a constant
plus a separate tag argument:

```smarty
{widget value=Thing::make($item)}{/widget}
```

```text
(source_file
  (custom_tag
    name: (identifier)
    (attribute
      name: (identifier)
      value: (static_method_call_expression
        class: (identifier)
        method: (identifier)
        argument: (variable name: (identifier)))))
  (custom_close_tag name: (identifier)))
```

Also check calls composed with a modifier, a condition and a foreach source.
Keep each field and tree shape explicit. Calls take only the ordinary expression
arguments already supported by this grammar; comma order and values must remain
distinct in the tree. Existing class-constant expressions such as
`Thing::READY` retain their current node and fields.

This task does not add namespace-qualified class names, dynamic class
receivers, static properties/constants beyond the existing constant rule,
method-result property or call chains, arbitrary PHP call semantics, or class
registration checks. Control-word and primitive-token class names accepted by
the existing class-constant rule are in scope for static calls as well.
Case-insensitive `self` and `parent` remain excluded: the pinned Smarty 5.8.4
recorder rejects those class names. Other exclusions may be valid Smarty
syntax; this task does not claim Smarty rejects them. Do not turn a static method call into an
unqualified `function_call_expression`, generic tag, or class constant.

## Checks to add before grammar changes

1. Add hand-authored trees for zero arguments, multiple ordinary arguments,
   and each of the eleven composition contexts in the Task 019 row of
   `docs/composition.md`. Include the exact direct-tag trees above to catch the
   current silent split into attribute value plus positional argument.
2. Add `fixtures('static-class-method-calls.txt')` reference checks for the
   valid fixtures. Compare tag names, ordered argument names/counts, and
   modifier/output events. The recorder cannot inspect class, method, or
   argument values; the hand-authored trees establish call ownership and fields.
3. Add a controlled `fullEngine` compile-mode check for
   `{DateTime::getLastErrors()}`. Do not invoke arbitrary application classes
   or execute the application corpus.
4. Preserve neighboring contracts: `{Thing::READY}` stays a
   `class_constant_expression`; `{Thing::make($x)}` is one
   `static_method_call_expression`; malformed `{Thing::($x)}` remains an
   error; `{if::foo()}`, `{true::foo()}`, and `{null::foo()}` are accepted as
   calls with identifier class fields; and `self`/`parent` receivers remain
   rejected. Unsupported namespaced or dynamic receivers are not silently
   reclassified as supported calls. Check the pinned reference before claiming
   any negative form is invalid Smarty syntax.
5. Test malformed recovery with a missing call closer and a following output:

   ```smarty
   {Thing::make($x}{$after}
   ```

   The exact intended tree is:

   ```text
   (source_file
     (output
       value: (static_method_call_expression
         class: (identifier)
         method: (identifier)
         argument: (variable name: (identifier))
         (MISSING ")")))
     (output value: (variable name: (identifier))))
   ```

   Assert an error remains, the missing close parenthesis is inside the call,
   and the independent `$after` output survives as the next sibling.
6. Check an incremental edit that changes `{Thing::READY}` into
   `{Thing::make($x)}` and back. Compare each edited tree snapshot with a fresh
   parse, including the enclosing output and adjacent independent siblings.
7. Run `npm test`; save before/after corpus reports outside `build/`, compare
   source and parser hashes, inspect every newly clean file's tree structure,
   and report remaining errors. Do not promise that all 17 selected files
   become clean or count swallowed calls as progress.

## Evidence limits and deferred work

The source grammar supports a static call followed by an object chain, but
method-result chains are excluded from this bounded first call task and remain
a visible Smarty-valid grammar gap. The report's other earliest-error clusters
and later errors remain project evidence: double-quoted Smarty string
interpolation, bitwise operators, word aliases, function-output attributes,
other built-in blocks, and expression/recovery gaps need separate diagnosis and
contracts. Task 016 remains deferred and unreviewed; Tasks 017 and 018 remain
complete.

## Task-creation review disposition

Independent task-creation review accepted (2026-10-01) after two revision
rounds. The reviewer reproduced the 467-template corpus report and confirmed
17 of the listed paths have a static class method call at the earliest error;
the additional trigger-table file is documented separately because an earlier
bare argument is its root error. The reviewer verified the pinned productions,
reference projection, generic-tag split, and all 11 composition probes. One
evidence wording correction clarified recorder-observed tag/argument names and
counts versus the hand-authored tree's call ownership. No findings remain.

## Implementation evidence (2026-10-01)

The implementation adds the distinct `static_method_call_expression` primary
with `class`, `method`, and repeated `argument` fields. Its precedence selects a
call when `(` follows `Class::name`, while the unchanged class-constant rule
continues to parse `{Thing::READY}` as `class_constant_expression`. The primary
is available through the audited shared expression contexts and the narrower
modifier-argument rule. Namespaced and dynamic receivers and method-result
chains remain errors in this subset.

The hand-authored fixture file has 18 trees: zero and multiple arguments, all
11 composition contexts (including both function and object-method argument
forms), and missing-close recovery with an adjacent output. The Node checks
verify all valid fixture references, exact class/method/argument fields and
ranges, the anonymous `::` delimiter, the generic-tag one-value boundary,
controlled full-engine compilation, malformed recovery, and a constant-to-call
incremental edit and reversal. The malformed tree places the missing `)` under
the call and preserves `$after` as the next sibling.

Expectation correction: the existing class-constant test had treated
`{Thing::READY()}` as unsupported. The pinned Smarty 5.8.4 recorder accepts
this minimized form, and it is a static method call rather than a class
constant. The check now requires the reference to accept it and the parser to
produce `static_method_call_expression`; `{Thing::READY}` remains a constant.
This correction is recorded in [`test/CONTRACT.md`](../../test/CONTRACT.md) and
the class-constant test.

Acceptance evidence:

- `npm test`: exit 0; 174/174 corpus trees, 245/245 Node checks, and 12/12
  deliberate mutation checks caught after review revision. Log:
  `/tmp/smarty-019-revision-test.log`.
- Baseline `/tmp/smarty-018-after.json`: 467 files, 382 clean and 85 failing;
  parser hash `1658ac9955178f0bbfc0a99937a075836408bb2b51233caf75efc4388d5090c3`.
- After `/tmp/smarty-019-after.json`: the same 467 paths, 396 clean and 71
  failing before the reserved class-name correction; parser hash
  `bb6e8299a9bad69c9fabc0cd9311f277923fe790f4f6d286ea97ac0f1a9c65c4`.
  Per-template source hashes match the baseline for all 467 inputs. There are
  14 newly clean files and zero clean-to-failing regressions. The
  newly clean templates were tree-audited; each has at least one explicit
  static call node (one to five per file), and no errors. The reserved-name
  review revision preserved those same 396 clean / 71 failing results with no
  new clean files or regressions; see `/tmp/smarty-019-review-after.json`,
  parser hash `bc07dada33635385d5ee4b4436c736ee1d5338d3603048e7bc005927cc5f6cc4`.
- All 17 previously identified first-error paths were not promised to become
  clean. Fourteen did; three remain among the 71 failing templates, with later
  independent errors possible. Remaining errors are still corpus gaps.

The mutation suite also checks that replacing static-call argument fields with
a generic `value` field causes the multi-argument expected tree to fail. The
matrix marks all 11 audited contexts `yes` with links to the relevant
hand-authored trees and Node checks. The full-engine check confirms compilation
only; it does not run the call or verify class registration, method behavior,
or returned values.

## Review revision (2026-10-01)

The implementation reviewer found a medium scope gap: static method receivers
did not yet admit the control-word and primitive-token names already supported
for class constants. Three hand-authored output trees and reference checks were
added for `{if::foo()}`, `{true::foo()}`, and `{null::foo()}` before the grammar
change; each failed in the old parser and is accepted by the pinned Smarty
5.8.4 recorder. The call receiver now uses the same reserved class identifier,
control-word identifier, boolean identifier, and null identifier choices as
`class_constant_expression`, while retaining the existing `self`/`parent`
exclusion. The method-result and namespace/dynamic boundaries are unchanged.

The added negative checks confirm that the pinned recorder rejects
`{self::foo()}` and `{parent::foo()}` with a static-class error; case variants
`SELF` and `PaReNt` are also rejected. Tree-sitter keeps all four as errors.
The final report compares `/tmp/smarty-019-after.json` and
`/tmp/smarty-019-review-after.json`: all 467 per-template source hashes match,
396 templates are clean and 71 fail in both reports, with no newly clean files
and no regressions from this refinement. The original 14 newly clean templates
remain structurally audited under the final parser.

## Implementation-review disposition

Independent implementation review accepted (2026-10-01) after the receiver
alias revision, with no remaining findings. The reviewer reproduced `npm test`
and a hash-matched corpus report, verified generated sources and all 11
composition contexts, checked the reserved receiver/reference boundaries and
class-constant correction, and inspected every newly clean tree. Recovery,
incremental edits, and documentation evidence agree with the accepted contract.
