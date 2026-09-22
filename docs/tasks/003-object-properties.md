# 003 — Static object property access

Status: ready. Dependencies: initial baseline only; recommended after 001 and 002.

## Scope and motivation

Add `$user->name` and repeated static property access such as `$app->template->name`.
Corpus evidence: `corpus/toolbar.tpl` contains `$app->template` as the receiver of
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

## Completion evidence (fill when implemented)

Test paths; reference observations; commands/results; report comparison; explicit
remaining call/indexing exclusions and any justified contract changes.
