# 003 — Static object property access

Status: complete (2026-09-22). Dependencies: initial baseline only; recommended after 001 and 002.

## Scope and motivation

Add `$user->name` and repeated static property access such as `$app->template->name`.
Corpus evidence: `corpus/application/toolbar.tpl` contains `$app->template` as the receiver of
a later method call. Many other object-access hints include calls, so this task
alone may clear few files. The initial report finds `->` in 412 failing files.

Exclude calls `(...)`, dynamic properties, static `::`, array/dot access, null-safe
access, and PHP runtime member validation. Method calls need a separate task.

## Proposed tree contract

Add `member_expression` with `object` (an expression) and `member` (identifier)
fields. Static chains associate left; member access binds tighter than arithmetic
and modifiers. Start with variable receivers and member chains, not arbitrary
PHP receiver forms.

```text
{$user->profile->name}
(source_file
  (output value: (member_expression
    object: (member_expression
      object: (variable name: (identifier))
      member: (identifier))
    member: (identifier))))
```

## Acceptance work

- Add `test/corpus/object-properties.txt` with the examples above,
  `{widget value=$user->name}`, `{$user->name|escape}`, `{if $user->active}Y{/if}`,
  and `{$item->price + $item->tax * 2}`. Specify fields and binding explicitly.
- Verify acceptance against the recording Smarty parser and inspect its variable/
  object productions in `TemplateParser.y`. Current projected observations cannot
  prove member structure: add exact-tree and exact member-text assertions.
- Include whitespace around `->` according to observed Smarty behavior. Verify
  that custom tag names and modifiers still work without registration.
- Require an error for `{$user->}`; edit a complete chain into that unfinished
  form and repair it. Compare all nodes/ranges with fresh parses after each edit.
- Run `npm test` and corpus reports. Preserve a minimized property-access fixture
  from the receiver in `toolbar.tpl`; do not claim the full method call is supported.

## Completion evidence

- [Manual trees](../../test/corpus/object-properties.txt) and
  [reference/range/recovery/edit checks](../../test/object-properties.test.mjs)
  cover chains, fields, arithmetic/modifier binding, unknown extensions,
  whitespace, unfinished chains, and composition with configs/comments.
- `npm test` failed on all 11 original new fixtures before implementation.
  An additional keyword-member fixture also failed before the scoped reserved-word
  fix. Final acceptance passes 37 trees, 57 Node checks and all 5 mutation checks.
  The new mutation verifies that a wrongly named receiver field is detected.
- Smarty 5.8.4 accepts whitespace (including LF/CRLF) on either side of `->`,
  matching the lexer's `ptr` rule. `objectchain` and `objectelement` productions
  support repeated static members. Smarty accepts `{$user->if->else->elseif}`;
  the grammar therefore clears reserved words only for property names, keeping
  malformed control-tag rejection intact. No proposed contract correction needed.
- `npm run corpus:report -- ./corpus/application /tmp/smarty-003-after.json` compared with
  `/tmp/smarty-002-after.json`: identical hashes for all 467 templates; 15 → 15
  clean, 452 → 452 failing; no clean-to-failing regressions. Reports remain local
  temporary artifacts. No newly clean files to promote wholesale.
- `corpus/application/toolbar.tpl:5` supplies `$app->template`, isolated from the later call
  as `{$app->template}` in the tracked corpus-receiver fixture. Its explicit
  variable receiver and member-name fields were inspected. This does not claim
  support for the original method call or full template.
- Calls, dynamic members, static `::`, null-safe access, dot/index access,
  arbitrary expression receivers and runtime validation remain excluded.
  Reference checks establish acceptance/events, not member structure or values;
  manual trees establish structure. No existing expected trees changed.
