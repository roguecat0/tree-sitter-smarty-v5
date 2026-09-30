# 014 — Default Smarty delimiter boundaries and auto-literal braces

Status: complete (2026-10-01). Independent brief review accepted after one
revision round; independent implementation review accepted after one evidence
revision. This is a syntax-accuracy task, not a general support for
application-specific Smarty configurations.

## Motivation and pinned reference evidence

The current Tree-sitter text rule stops at every `{` or `}`. Smarty 5.8.4's
default lexer does not treat every brace as a template boundary. The default
`auto_literal` setting is enabled. The lexical rule is asymmetric: in TEXT, a
left delimiter whose next character is whitespace starts a `userliteral` match
and remains text; `{}` is explicitly matched as text; otherwise a left
delimiter begins tag lexing. A right brace in TEXT does not begin a Smarty
construct. Once a tag is active, the tag-body right-delimiter rule accepts
optional preceding whitespace, so whitespace before `}` cannot undo an active
opening tag. These behaviors are visible in
`vendor/smarty/smarty/src/Lexer/TemplateLexer.plex`: `isAutoLiteral()` at line
271, the `emptyjava`, `userliteral`, and delimiter patterns at lines 283–287,
the TEXT rules at lines 344–370, and TAGBODY's `rdel` at lines 448–453.

Pinned Smarty 5.8.4 full-engine observations (the `version` field returned by
`test/helpers.mjs` must equal `5.8.4` for every observation) are:

| Named minimized source | Full-engine result | Reference result |
| --- | --- | --- |
| `A { foo } B` | renders exactly `A { foo } B` | `events: []; error: null` |
| `A { foo} B` | renders exactly `A { foo} B` | `events: []; error: null` |
| `A {foo } B` | `Smarty\CompilerException`: `Syntax error in template "string:A {foo } B"  on line 1 "A {foo } B" unknown tag 'foo'` | `events: [{"kind":"tag","name":"foo","arguments":[]}]; error: null` |
| `A {foo} B` | `Smarty\CompilerException`: `Syntax error in template "string:A {foo} B"  on line 1 "A {foo} B" unknown tag 'foo'` | `events: [{"kind":"tag","name":"foo","arguments":[]}]; error: null` |
| `{}` | renders exactly `{}` | `events: []; error: null` |
| `A } B` | renders exactly `A } B` | `events: []; error: null` |
| `A {{ foo B` | renders exactly `A {{ foo B` | `events: []; error: null` |
| `{if true }Y{/if}` | renders `Y` | `events: [if, ifclose]; error: null` |

The two one-sided cases are deliberate: `{ foo}` is literal because the first
character after `{` is whitespace, while `{foo }` is an active unknown tag
because the opening delimiter is adjacent to `foo`. The right-side whitespace
does not change that classification. Repeated opening braces and raw right
braces are also ordinary rendered text in these examples.

Evidence must be reproducible against the repository-pinned full Smarty engine,
not inferred from Tree-sitter output. Use `fullEngine(source)` and
`reference(source)` from `test/helpers.mjs`; assert their returned `version` is
exactly `5.8.4`. Record the exact source string, full-engine `result` or error
type/message, and reference `events`/`error` in the task evidence. Correlate
those results with the pinned lexer rules cited above. The full-engine helper
renders only these controlled fixtures; it does not execute the application
corpus. Smarty's parser/reference projection verifies tags and errors but not
rendered literal bytes or Tree-sitter structure.

## Scope and proposed tree contract

Match Smarty's default `auto_literal=true` boundaries for the default `{` and
`}` delimiters. Literal runs remain named `text` nodes; active constructs use
the existing grammar and fields. Preserve later independent Smarty constructs
after literal brace text. The following cases are required as manually
specified expected trees in `test/corpus/smarty-reference.txt`:

### `auto-literal-left-and-right-whitespace`

Source:

```smarty
A { foo } B
```

Expected tree:

```text
(source_file (text))
```

The single `text` node spans the complete source including both braces. The
full engine renders the source byte-for-byte and the reference reports no tag
events.

### `auto-literal-empty-braces`

Source: `{}`

Expected tree:

```text
(source_file (text))
```

This is one text node spanning both braces, not an empty or malformed tag.

### `auto-literal-opening-side-only`

Source: `A { foo} B`

Expected tree:

```text
(source_file (text))
```

The full engine renders the full string unchanged. This case establishes that
whitespace immediately after the opening brace is sufficient even though no
whitespace precedes the right brace.

### `auto-literal-active-tag-right-whitespace`

Source: `{if true }Y{/if}`

Expected tree:

```text
(source_file
  (if_block
    (if_tag condition: (boolean))
    (text)
    (if_close_tag)))
```

The body `text` spans `Y`. The full engine renders `Y`; the reference reports
the `if` and `ifclose` events. The opening `{if` is active despite the space
before its closing delimiter.

### `auto-literal-raw-right-and-repeated-left-braces`

Required independent sources and exact trees:

```text
Source: A } B
Tree:   (source_file (text))

Source: A {{ foo B
Tree:   (source_file (text))
```

Each text node spans the whole source. Smarty 5.8.4 renders each source
unchanged and emits no reference tag events. Do not turn a raw `}` into an
error or classify the second `{` in `{{` as an independent active construct.

### `auto-literal-html-script-composition`

Source:

```html
<script>const x = { foo: 1 };</script>{if true }Y{/if}<script>if (x) { go(); }</script>
```

Expected tree:

```text
(source_file
  (text)
  (if_block
    (if_tag condition: (boolean))
    (text)
    (if_close_tag))
  (text))
```

The first and last `text` nodes each preserve their complete script source,
including the JavaScript braces. The block body is `Y`. Smarty 5.8.4 renders
`<script>const x = { foo: 1 };</script>Y<script>if (x) { go(); }</script>`;
the reference events are exactly `if`, `ifclose`. This exact case checks
literal JavaScript object/block braces immediately adjacent to real Smarty
constructs.

## Malformed input and boundary-crossing edit

### `auto-literal-unclosed-active-block-recovers-next-output`

Source: `{if true }Y{$ok}`

Expected recovery tree:

```text
(source_file
  (ERROR
    (if_tag condition: (boolean))
    (text)
    (output value: (variable name: (identifier)))))
```

Assert `root.hasError === true`, and assert that the later `output` and its
`variable` field remain present under the recovery `ERROR`. Smarty 5.8.4 full
compilation reports an unclosed `{if}`; its recording parser still observes
`if` and `output`. This check requires useful editor recovery, not a claim that
the malformed source compiles. If an implementation cannot keep this exact
recovery shape, its owner must explain the changed shape and retain a precise
assertion proving the later output was not discarded or swallowed as text.

### One-character edit across the opening boundary

Start with source `A {foo} B` and expected tree:

```text
(source_file (text) (custom_tag name: (identifier)) (text))
```

Insert one ASCII space immediately after `{`, yielding `A { foo} B`, whose
expected tree is `(source_file (text))`. Assert the exact before and after
trees, no parse errors in either version, and that the incrementally edited
tree equals a fresh parse of the after source. In 5.8.4 the before source is
an active `foo` tag (the full compiler reports unknown tag `foo`; the reference
reports one `foo` event) while the after source renders literally and has no
reference events. Assert both helper version fields are `5.8.4`.

## Exclusions

Do not implement `{literal}...{/literal}` lexical regions, custom user literal
sequences, non-default left/right delimiters, or `auto_literal=false` here.
Keep these as separate project gaps in the feature inventory. This task does
not alter expression or tag syntax beyond deciding whether the default opening
brace starts a Smarty construct.

## Acceptance work

1. Add the manually specified `test/corpus/smarty-reference.txt` cases above
   and failing full-engine/reference/Tree-sitter/edit checks before editing the
   grammar. Never auto-update expected trees.
2. Implement only the default boundary behavior in `grammar.js` or a scanner if
   justified. Preserve named `text` nodes, source ranges, and later independent
   Smarty constructs. Do not add broad fallback text that swallows active tags.
3. Run the controlled full-engine/reference evidence protocol above for every
   example. Include malformed compiler rejection and successful parsing of the
   later construct in the recovery evidence.
4. Run `npm test` and a hash-matched local corpus report. Inspect newly clean
   trees and report remaining errors. Update the feature row, contract, brief
   status and evidence only after the gates pass.

## Brief-review disposition

Independent task-creation review accepted (2026-10-01) after one revision
round. The reviewer requested exact expected trees, raw right/repeated brace
coverage, one-sided whitespace evidence, and concrete composition/edit/recovery
assertions. The revised brief pins all examples to Smarty 5.8.4 lexer rules and
full-engine/reference outputs, verifies both helper version fields, and defines
manual trees and exact edit/recovery contracts. Re-review accepted with no
blocking findings; the optional wording cleanup did not change the approved
scope.

## Implementation evidence (2026-10-01)

The expected trees and Node checks were copied into a detached checkout at the
pre-task revision `5bf0961` before testing the implementation. Running
`node --test test/default-auto-literal.test.mjs` there failed on empty braces,
raw right braces, repeated left braces, script composition, and the active to
literal boundary edit, confirming the new checks exposed the existing gap.
Implementation changed `grammar.js` and `src/scanner.c`: named `text` is now an
external token that stops before active openings and keeps Smarty's default
auto-literal whitespace, empty-brace, and raw-right-brace forms in text. The
scanner checks the six ASCII characters matched by Smarty's default PCRE `\s`
class rather than locale-dependent wide-character classification. No grammar
or scanner fallback consumes an active opening delimiter.

`npm test` passed after regeneration and native rebuild: 133 manually specified
corpus trees, 194 Node checks, and 11 mutation catches. The mutation suite still
caught each deliberate structural defect. The exact edit check preserves the
active `{foo}` node before inserting one space, changes it to one `text` node,
and matches a fresh parse. The malformed unclosed-if tree retains the later
output and variable beneath `ERROR`.

Hash-matched local corpus reports used the same 467 source files and per-file
SHA-256 values. Before, parser SHA-256 was
`e5a3e67725a10d3dbabe62ec0987a0b5b972821a4f7fc4a7a73ebb4a39ce530f`, with 142
clean and 325 failing files. After, parser SHA-256 was
`e6e522b8203e05dfa4e601284cc91e4b4d4e848f3ef67a947e505c5ae4c66963`, with 186
clean and 281 failing files. There were no clean-to-failing regressions. The
full JSON reports were saved outside `build/` at
`/tmp/smarty-task014-evidence/before.json` and
`/tmp/smarty-task014-evidence/after.json`.

All 44 newly clean files were reparsed and their named trees inspected. None is
a text-only root: 22 contain top-level `if_block`, 7 contain `foreach_block`,
41 contain `output`, 33 contain `custom_tag`, 12 contain `comment`, and 5
contain `custom_close_tag` (categories overlap). These files are:

```text
action_types/action_value_commandbutton.tpl
action_types/search/action_value_replace_part_search.tpl
action_types/search/action_value_user_select_search.tpl
mails/mail_index_original.tpl
mails/mail_index.tpl
view_action/action_details.tpl
view_action/add_action_type_request_dialog.tpl
view_action/browse_chem_prod.tpl
view_action/edit_measurement_device.tpl
view_action/instruction.tpl
view_action/mapped_action_types_dialog.tpl
view_action/view_instructions_scripts.tpl
view_admin/action_types/edit_action_type_competence_level_dialog.tpl
view_admin/action_types/edit_action_type_parameter_dialog.tpl
view_admin/action_types/edit_trigger_dialog.tpl
view_admin/action_types/map_module_type_dialog.tpl
view_admin/action_types/map_module_type_group_dialog.tpl
view_admin/module_types/dlg_add_action_type.tpl
view_admin/module_types/dlg_move_module_type.tpl
view_admin/module_types/edit_fb_parameter_dialog.tpl
view_admin/sw_hw/sw_hw_lists_dialog.tpl
view_admin/users/change_compentece_for_multiple_users_dialog.tpl
view_certificate/cal_certificate.tpl
view_certificate/certificate.tpl
view_config/add_watch_dialog.tpl
view_fabrication/add_fabrication.tpl
view_module/export_instruction.tpl
view_module/module_attachments.tpl
view_module/module_information_edit_module_type.tpl
view_module/module_information_edit_owner.tpl
view_module/module_information_edit_parent.tpl
view_module/module_information_edit_rfid.tpl
view_module/module_repairs.tpl
view_module/technical_information.tpl
view_packaging/scan_barcode.tpl
view_repair/barcode_dialog.tpl
view_repair/select_repair.tpl
view_repair/used_device_add_dlg.tpl
view_repair/used_devices_dialog.tpl
view_sap/request_error.tpl
view_sap/upload_article_picture_script.tpl
view_tools/create_module_type_dialog.tpl
view_wage_work/for681.tpl
view_wage_work/send_receive_messages.tpl
```

The corpus remains incomplete: 281 files still have parse errors and require
investigation under later bounded tasks. The controlled full-engine and
reference checks are limited to fixtures; the corpus results do not establish
all Smarty syntax or runtime semantics.

Implementation review accepted (2026-10-01). The reviewer independently
reproduced `npm test`, verified all reference results including exact unknown
tag compiler messages, checked generated parser freshness and the hash-matched
corpus reports, and inspected the structured trees of all 44 newly clean files.

Implementation-review revision: the exact full-engine exception message and
recording-reference `events` plus `error: null` are now recorded for both
`A {foo} B` and `A {foo } B` in the observation table and asserted in the Node
check. The focused task check passes all 10 tests, and the full `npm test`
rerun passes 133 corpus trees, 194 Node checks and 11 mutation catches. No
grammar source changed during this revision; the current generated parser hash
still matches the saved after-corpus report, so the 186/281 corpus result
remains hash-matched.
