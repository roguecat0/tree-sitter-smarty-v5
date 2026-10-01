# 012 — Foreach item metadata

Status: complete (2026-09-30). Independent implementation review accepted.
Brief accepted (2026-09-30) after one revision round.
Independent brief review accepted the explicit positive tree for unknown
suffixes and hand-authored coverage for all seven standard properties. The
reviewer verified that unknown suffix acceptance is limited to syntax, not
runtime validity. Dependencies: 006 (modern foreach blocks), 011 (full
expression calls and current primary-expression precedence). Task creation owner:
current hash-matched report `/tmp/smarty-011-final-after.json`.

## Motivation and corpus evidence

The report measures 467 Smarty-accepted local templates with parser hash
`367c09919242b1359f6b0431ad126e3baca253494292a590fb17d8374a9dcdfa`: 135 parse
cleanly and 332 contain errors. A residual scan of failing files finds item
metadata such as `$value@index`, `$row@first`, and `$message@last` in 139 files;
the report has a parser error adjacent to one of these forms in 138 of those
files (228 error-adjacent occurrences). `@index` appears 216 times in failing
files, `@last` 10 times, and `@first` 7 times. Counts are lexical triage and
overlap other syntax errors; they do not predict how many whole files this task
will clean.

Concrete examples include `corpus/application/action_types/action_value_measurement.tpl:29`
and `:39` (`$value@index` in output) and
`corpus/application/extensions/gsmr/stock.tpl:8` (`$row@first` and `$row@index` in
conditions). The minimized valid form
`{foreach $items as $item}{$item@index}{/foreach}` is accepted by Smarty 5.8.4's
recording compiler and full compiler, while the current Tree-sitter parse reports
`ERROR (UNEXPECTED '@')` and leaves the property identifier outside the value.
The corresponding `{if $item@first}...{/if}` condition is also accepted by the
recording compiler and rejected by the current grammar at `@`.

## Scope

Recognize a static metadata suffix on a simple foreach item variable as a
primary expression in all existing expression contexts. Preserve the base
variable and metadata identifier as distinct children. The proposed named node
is `loop_metadata_expression`, with `item: (variable)` and
`property: (identifier)` fields; `@` remains anonymous punctuation. Do not
resolve loop scope, validate that the base variable matches an enclosing
`foreach`, or evaluate metadata at parse time.

The Smarty `ForeachTag` compiler lists the standard item properties as `first`,
`last`, `index`, `iteration`, `show`, `total`, and `key`. The parser production
itself accepts `varvar AT ID`, so tree structure should retain an identifier
without claiming runtime validity for every possible name. Hand-authored
expected trees must cover every listed property. Also include an unknown suffix
such as `madeup` and assert that it has the same identifier field and spelling;
this makes the no-allowlist boundary testable. Do not add `is ... by` operators
in this task even where they share a corpus condition.

```smarty
{foreach $items as $item}{$item@index}{/foreach}
```

```text
(source_file
  (foreach_block
    (foreach_tag
      source: (variable name: (identifier))
      item: (variable name: (identifier)))
    (output value: (loop_metadata_expression
      item: (variable name: (identifier))
      property: (identifier)))
    (foreach_close_tag)))
```

Metadata composes as a primary expression in an existing condition and in an
output with a modifier:

```smarty
{foreach $items as $item}{if $item@first || $item@last}{$item@index|escape}{/if}{/foreach}
```

```text
(source_file
  (foreach_block
    (foreach_tag source: (variable name: (identifier)) item: (variable name: (identifier)))
    (if_block
      (if_tag condition: (binary_expression
        left: (loop_metadata_expression item: (variable name: (identifier)) property: (identifier))
        right: (loop_metadata_expression item: (variable name: (identifier)) property: (identifier))))
      (output value: (modifier_expression
        value: (loop_metadata_expression item: (variable name: (identifier)) property: (identifier))
        name: (identifier)))
      (if_close_tag))
    (foreach_close_tag)))
```

Tree-sitter corpus expectations show named-node structure but cannot encode
the spelling of fields attached to anonymous operator tokens. As in the
existing operator fixtures, these trees show binary nesting without an
operator token; `test/loop-metadata.test.mjs` directly asserts the `||` and
`>` operator field text while checking metadata operands.

## Reference boundary (Smarty 5.8.4)

`vendor/smarty/smarty/src/Parser/TemplateParser.y` defines
`variable ::= varvar AT ID` around line 906. The pinned lexer names `AT` as `@`.
`vendor/smarty/smarty/src/Compile/Tag/ForeachTag.php` lists the standard item
properties around lines 52–61. `test/reference.php` accepts the minimized
`@index` output and `@first` condition examples. It records surrounding
`foreach`, `output`, and `if` events only; it cannot inspect the expression
node, property value, variable binding, or runtime loop semantics. A fixed
full-engine observation with a two-item array renders item `@index`, `@first`,
`@last`, `@iteration`, `@show`, `@total`, and `@key` without a compiler error.
An unknown suffix also parses, though rendering warns for an undefined runtime
property; it must not be used to claim that arbitrary names are valid metadata.

Smarty rejects whitespace between the item variable and `@`, and rejects a
missing property name (`{$item@}`). Preserve these as negative cases. It accepts
an unknown property token at parse/compile time; the recording adapter accepts
`{foreach $items as $item}{$item@madeup}{/foreach}` without an error. The full
engine warns about an undefined runtime property, so this observation supports
syntax acceptance and tree shape only, not runtime validity. No loop-binding or
property validation is part of this structural task.

## Acceptance work

1. Before grammar changes, hand-write `test/corpus/loop-metadata.txt` and add
   `test/loop-metadata.test.mjs` with failing checks. Include output `@index`,
   condition `@first`/`@last`, and a generic-tag attribute value. Add an
   explicit hand-authored tree containing all seven standard names: `first`,
   `last`, `index`, `iteration`, `show`, `total`, and `key`. Also add
   `{foreach $items as $item}{$item@madeup}{/foreach}` as a positive structural
   case, asserting `loop_metadata_expression`, `item` and `property` fields,
   and the exact property text `madeup`; do not claim runtime validity. Assert
   property spelling, source ranges, and anonymous `@` token for the standard
   names as well.
2. Compose metadata with existing arithmetic/comparison/boolean operators,
   modifier input or result, output, `if`/`elseif`, and unknown-tag values.
   Keep the surrounding foreach block and close nodes explicit. Use
   `fixtures('loop-metadata.txt')` to compare reference-visible surrounding
   events, and state that the projection cannot prove metadata structure.
3. Add parser-error and Smarty-reference rejection checks for missing property
   (`{$item@}`) and whitespace (`{$item @index}`), preserving valid neighboring
   output and the enclosing `{/foreach}` in recovery. Do not reject unknown
   identifier suffixes solely because runtime validation is unavailable.
4. Add an edit that inserts/deletes the `@property` suffix inside an output or
   condition and compare full incremental snapshots with fresh parses through
   error and repair. Preserve nearby text and block structure.
5. Add a focused mutation only if the hand trees could miss loss of either field
   or treating `@index` as a generic tag argument; identify the distinct fault.
   Do not modify generated sources or vendored Smarty files.
6. Run `npm test` and hash-matched before/after corpus reports outside `build/`.
   Inspect newly clean structures and regressions. Do not remove any of the 467
   accepted corpus files. Keep `is div by`, other word operators, switch,
   literal blocks, output attributes, and unrelated residual syntax visible as
   separate gaps.
7. Update the contract, feature row, task status, and evidence after checks pass.
   Report actual newly clean/error counts and remaining errors; no whole-file
   clean quota is implied.

## Scope decisions for review

- This brief is limited to `$item@identifier` syntax. Smarty's separate
  `$smarty.foreach.name.property` form already parses through the current
  dot/index chain; this task does not add special runtime semantics or a new
  tree shape for that spelling.
- `@` properties are not restricted to a locally maintained allowlist because
  the pinned parser accepts `ID` after `AT`; the task structurally retains the
  name and avoids unsupported claims about runtime properties.
- The co-occurring `is div by` condition is a separate operator family. Do not
  bundle it into metadata or count lexical pairing as proof of one task.
- Suggested next residual priorities after this task: common word operators
  (including `is div by`, after minimized reference cases), built-in switch
  blocks, and literal blocks. Bitwise-looking characters and broad switch/literal
  hints need separate exact-source classification before task creation.

## Implementation evidence

Independent implementation review accepted (2026-09-30), including the
arithmetic-composition finding fix. The implementation adds
`loop_metadata_expression` as a primary expression with `item: (variable)` and
`property: (identifier)`, preserving adjacent `@` as anonymous punctuation and
allowing identifier spellings without a runtime property allowlist. Hand trees
cover all seven compiler-listed standard property names, `@madeup`, output,
modifier, conditions, arithmetic/comparison/boolean composition, and a
generic-tag attribute. Node checks verify all standard property spellings and
ranges, exact unknown-name structure, operator fields, malformed syntax and
recovery, Smarty reference projection, and incremental break/repair
equivalence.

`npm test` passes: 124 corpus trees, 180 Node checks, and 11/11 deliberate
mutation catches. Hash-matched corpus reports are
`/tmp/smarty-011-final-after.json` before and `/tmp/smarty-012-after.json`
after; both contain the same 467 input hashes. The grammar report hash changes
from `367c09919242b1359f6b0431ad126e3baca253494292a590fb17d8374a9dcdfa` to
`e5a3e67725a10d3dbabe62ec0987a0b5b972821a4f7fc4a7a73ebb4a39ce530f`. Clean
files rise from 135 to 142; failing files fall from 332 to 325. Seven files
become clean and no previously clean file regresses. Each newly clean file's
tree contains explicit `loop_metadata_expression` nodes with the base item and
exact property identifier: 2 in `action_types/action_value_measurement.tpl`, 4
in `mails/measurement_device_calibration.tpl`, 2 in
`view_action/instruction_time_line.tpl`, 1 in
`view_admin/name_list_carriers/name_list_carrier_article_number_table.tpl`, 2
in `view_module/full_instruction_changes_details.tpl`, 1 in
`view_packaging/view_packaging_instruction_only.tpl`, and 4 in
`view_tools/ownership_table.tpl` (16 total). Unknown runtime property behavior
and loop-binding validation remain unsupported. Other residual syntax,
including `is div by`, remains visible and unaddressed.
