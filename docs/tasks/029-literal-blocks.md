# 029 — Default-delimiter literal blocks

**Status:** complete (2026-10-02). Dependencies: [002 comments](002-comments.md), [014 default brace boundaries](014-default-auto-literal-boundary.md), and [015 composition audit](015-composition-audit.md). Independent creation review accepted after revision: minimized Smarty-reference fixtures are placed in `test/corpus/smarty-reference.txt` per `docs/expanding.md`; task-specific extension fixtures remain in `test/corpus/literal-blocks.txt`. Independent completion review accepted after correcting the obsolete contract gap wording; verified scanner token alignment, recovery, incremental edits, corpus evidence, and full acceptance gate.

## Motivation and application corpus evidence

At parser SHA-256
`642a756e6e4ae968c63ac83bdd9043965dc33b5a59a9409c489532370d32b0a9`, two
application templates fail in CSS contained by standard `{literal}` regions.
The first error in both is at the `{literal}` body on line 11; examples include
`div {line-height: 150%}` and CSS rules with braces. The grammar currently
parses Smarty-shaped text inside these regions as active syntax or errors, while
Smarty emits it literally. This is a direct application-corpus completeness gap
and an editor tree-shape gap.

Keep corpus reports separate. Each baseline is pinned to the same parser hash;
report SHA-256 values below verify the saved JSON contents.

| Root | Baseline report | Report SHA-256 | Files | Clean / errors |
| --- | --- | --- | ---: | ---: |
| `corpus/application/` | `/tmp/smarty-task028-followup-after-application.json` | `b093ea9802261bc169c4674f0dfa5a7e16bd5a7a7e1b75e4ea000a39027bd325` | 467 | 456 / 11 |
| `corpus/upstream-smarty-v5.8.4-core/` | `/tmp/smarty-task028-followup-after-core.json` | `604d9127b0e30b664bf14bdbc45e34477a066911db2668f38b91fcd814afe4c2` | 33 | 24 / 9 |
| `corpus/upstream-smarty-v5.8.4-example/` | `/tmp/smarty-task028-followup-after-example.json` | `7bd505f87a0fc30f90a62a8ee0f37e67aa16f9871a65867a5638bd83e7d4ec25` | 1 | 0 / 1 |

Application sources and hashes:

- `view_stats/action_chart.tpl` — SHA-256
  `8b4b9cae935b0c061140f111128cd6dffc4764d3199df8a46be17f108ccfc5d3`; its
  first report error is line 11 inside the CSS literal region. A separate
  later `neq` expression is an independent standard operator gap.
- `view_stats/stats.tpl` — SHA-256
  `63ad89047e65d31e5b32b685e5e2daee78e711e58f71cb789ad88402cd1219cb`; its
  first report error is also line 11 inside the CSS literal region. It has
  additional errors after the literal block, so this task does not promise that
  the whole file becomes clean.

The selected upstream core set currently has no literal-region fixture among
its 33 files; the demo has no literal-region example. Those zero/error counts
remain independent evidence, not a reason to narrow standard syntax scope.
The two application files contain Smarty syntax after their raw CSS regions
(`neq` and other expressions) that may remain errors after this task. Do not
promise a whole-file clean gain; inspect the after trees and continue recording
remaining standard gaps.

## Pinned Smarty 5.8.4 evidence

The project pins Smarty v5.8.4 commit
`94a27cbbc7820198d7adc17a2be8d457fb267753`. In
`vendor/smarty/smarty/src/Lexer/TemplateLexer.plex` (SHA-256
`7b6544d902af60fed5b21c55f0ced2cc3a02c33f9123a7891e032dfe478f87d3`), the
TEXT state recognizes the literal opener and enters a dedicated LITERAL state.
The LITERAL state scans raw bytes up to a matching literal marker. Its
`literal_cnt` increments for a nested opener; a nested closer decrements that
counter and remains content; only the closer at depth zero exits to normal
template lexing. The body-search regular expression is
`(SMARTYldel)SMARTYal[\/]?literalSMARTYrdel/isS`, so literal marker names are
matched case-insensitively and the optional slash distinguishes open/close
markers. In this regex, `SMARTYrdel` is replaced by the configured right
delimiter exactly; it does not use the whitespace-tolerant `rdel` lexer token.
`vendor/smarty/smarty/src/Compiler/Template.php` (SHA-256
`6391c91b5c758787960fb98419c4ddc955dec3f4def99a19cb4d57a414a01fd8`) shows
`replaceDelimiter()` replacing the placeholder with `$this->rdelPreg`, whose
default is `[}]`. The `TemplateParser.y` productions at lines 271–288 (SHA-256
`549769dd1cf7c61dad9909ddcec03cf17c6cf2096611b824e876f2250a1c3189`) combine
the nested content into a single output-text parse-tree string. The exact
lexical behavior is the contract for nested regions: their inner
`{literal}`/`{/literal}` spellings remain literal body bytes, not nested
Smarty syntax.

The pinned official designer page
`vendor/smarty/smarty/docs/designers/language-builtin-functions/language-function-literal.md`
(SHA-256 `b209bfa546d39a35b85d0b01533de892d0803d6fadcb639959ac4d1438c584e0`)
shows a JavaScript function body whose braces need literal escapement. The
`smarty-reference.txt` JavaScript-brace fixture below is minimized from that
example;
the hidden-output and nested-marker cases are minimized probes of the pinned
lexer/parser behavior and are independently checked against Smarty 5.8.4.

The following local reference observations were run against Smarty 5.8.4 with
`php test/reference.php` and `php test/full-engine.php`:

- `{literal}<b>{$name}</b>{/literal}{$after}` produces only one recorder
  `output` event for `$after`; full-engine rendering with `name=x` and
  `after=ok` returns `<b>{$name}</b>ok`.
- `{literal}a{literal}b{/literal}c{/literal}{$after}` renders
  `a{literal}b{/literal}c` before `after`; nested markers are preserved in the
  outer body's bytes.
- The full engine accepts `{literal }A{/literal}` and
  `{literal   }A{/literal}`. It rejects `{ literal}A{/literal}` because the
  opener name must immediately follow the left delimiter. Mixed-case
  `{LiTeRaL   }A{/lItErAl}` is accepted; the apparent `if` tag in
  `{LiTeRaL}A{IF $x}B{/LiTeRaL}` remains literal content.
- Exact closing spellings such as `{/literal}` and `{/LiTeRaL}` close the
  region. `{/literal }`, `{/literal   }`, and `{/ literal}` do not match: the
  compiler reports “missing or misspelled literal closing tag”. This differs
  from the opener rule: the opener's `rdel` lexer token allows whitespace
  before `}`, while the LITERAL state's body-search regex substitutes the
  exact right delimiter and does not. The generated `TemplateLexer.php` has
  the same body-search expression at line 946; this resolves the apparent
  `rdel` discrepancy in `TemplateLexer.plex`.
- `{literal}raw` causes the pinned compiler to report “missing or misspelled
  literal closing tag”. The recorder exposes that lexer error but does not
  return a normal tag event for it.
- False close lookalikes such as `{literalty}` and `{ /literal}` remain body
  bytes; they do not terminate the region.

The ordinary recorder cannot verify opaque tree structure or renderer output.
Use fixed full-engine cases for the outputs above and manually authored trees
for the new node boundary. Do not infer output behavior from the event list.

## Bounded task scope and tree contract

Add default `{`/`}` `{literal}` regions with exact raw-body preservation and
case-insensitive opener/closer names. An opener is recognized only in ordinary
template text; Smarty-looking text in the region does not produce output,
comment, tag, or expression nodes. The opening delimiter accepts whitespace
before `}` as Smarty's lexer does; the closing delimiter requires `/literal`
immediately followed by the right delimiter. Support nested literal markers
by retaining both inner marker spellings inside the outer raw content and
closing only the matching outer region.

Proposed nodes:

- `literal_block` owns one `literal_tag`, optional `content:
  literal_content`, and one `literal_close_tag`.
- `literal_tag` and `literal_close_tag` preserve the complete source spelling
  and ranges, including case and delimiter whitespace accepted for the opener.
- `literal_content` preserves the exact bytes between the outer delimiters,
  including all nested literal marker spellings and apparent Smarty constructs.
- Empty literal bodies omit `literal_content`; do not invent a zero-length
  content token.
- Ordinary constructs immediately before and after a region remain siblings in
  `source_file` or their existing owning block.

Hand-author the minimized cases backed by pinned Smarty behavior and official
documentation in `test/corpus/smarty-reference.txt`, following the placement
rule in `docs/expanding.md`. Name them with the Smarty version and feature:
`smarty-5.8.4-literal-opaque-output`,
`smarty-5.8.4-literal-nested-markers`, and
`smarty-5.8.4-literal-official-js-braces`. Their manually specified expected
trees are:

```text
{literal}<b>{$name}</b>{/literal}{$after}
(source_file
  (literal_block
    (literal_tag)
    content: (literal_content)
    (literal_close_tag))
  (output value: (variable name: (identifier))))

{literal}a{literal}b{/literal}c{/literal}
(source_file
  (literal_block
    (literal_tag)
    content: (literal_content)
    (literal_close_tag)))

{literal}function myBar {alert('Bar!');}{/literal}{$after}
(source_file
  (literal_block
    (literal_tag)
    content: (literal_content)
    (literal_close_tag))
  (output value: (variable name: (identifier))))
```

The first content node's exact text is `<b>{$name}</b>`; the nested fixture's
exact content is `a{literal}b{/literal}c`; the documentation-derived content is
`function myBar {alert('Bar!');}`. Tests must assert exact node text and source
ranges rather than relying only on no-error parsing. Keep additional
task-specific tree cases in `test/corpus/literal-blocks.txt`, including empty
regions, exact line-ending preservation, raw CSS braces, and literal blocks
composed inside `if`/`foreach`; do not put the reference-derived cases only in
that task-specific file.

## Failing checks and required acceptance coverage

Before grammar edits, hand-write the reference-derived trees in
`test/corpus/smarty-reference.txt`, add task-specific trees to
`test/corpus/literal-blocks.txt`, and add `test/literal-blocks.test.mjs`. Run
`node --test test/literal-blocks.test.mjs` first and retain the intended
failures. Two minimal current-parser observations establish the gap:

1. `{literal}<b>{$name}</b>{/literal}{$after}` currently parses without an
   error but incorrectly includes an `output` node for `$name` inside the raw
   region; the reference/full-engine results above prove that it must remain
   content.
2. `{literal}div {line-height:150%}{/literal}` currently reports a Tree-sitter
   `ERROR` in the CSS-like body, matching the first-error pattern in the two
   application templates.

Hand-author expected trees for empty and non-empty regions, exact CRLF and LF
content, raw braces and quotes, apparent outputs/comments/opening and closing
tags, false close lookalikes, case-insensitive names, opener whitespace, nested
literal markers, and ordinary Smarty output before/after. Include exact
acceptance checks for `{literal   }` and mixed-case markers, and full-engine
rejection checks for `{/literal   }` and `{/ literal}`. Add a literal block inside supported
`if`/`foreach` composition and confirm following expressions resume normal
parsing after the close. Keep unknown tags outside literal regions as separate
opening/closing nodes with their supported arguments; inside the region they
are raw content. Do not add generic custom-tag nesting.

In `test/literal-blocks.test.mjs`, load the three reference-derived fixtures
from `fixtures('smarty-reference.txt')`, selecting the names
`smarty-5.8.4-literal-opaque-output`,
`smarty-5.8.4-literal-nested-markers`, and
`smarty-5.8.4-literal-official-js-braces`. Compare only observable output
events and event order; the `{$name}` hidden in literal text must not appear
as an output event. Load any additional task-specific fixture set with
`fixtures('literal-blocks.txt')` for focused tree/range assertions; do not
compare those entries to Smarty unless they are separately promoted to the
reference corpus with evidence. Use `fullEngine()` on fixed cases to verify
that apparent Smarty syntax and nested markers render byte-for-byte literally,
and that `$after` after the close still interpolates.

Recovery tests must cover an unclosed opener, a standalone closer, and a close
lookalike followed by a real close. The unclosed region must not be accepted as
a normal closed block; preserve the opening node and valid content available
before EOF, and report an error or missing close. The standalone closer must
not become an ordinary generic closing tag. For incomplete editing, remove and
restore the outer close and compare full incremental `snapshot()` results with
fresh parses; repair a false close spelling into the real close and verify that
the neighboring post-region Smarty output is reclassified identically. Do not
make speculative claims about recovering Smarty constructs swallowed before a
missing closing delimiter is inserted.

Add a mutation that removes opaque literal content or re-enables parsing of
Smarty-looking body text, and show that the manual tree/reference test catches
it. Run `npm test`; save the after reports outside `build/` for all three roots,
match each source-hash set to its corresponding baseline above, inspect all
regressions and newly clean files, and structurally inspect any newly clean
template. Confirm that raw CSS no longer creates parse errors while reporting
remaining errors such as `neq` separately. Do not combine corpus totals or
attribute improvements to unrelated syntax to this task.

## Implementation evidence (2026-10-02)

The grammar now produces `literal_block` with `literal_tag`, optional exact-byte
`literal_content`, and `literal_close_tag`. The scanner recognizes a case-
insensitive opener with optional whitespace before `}`, treats nested marker
spellings as body bytes, and closes on the first matching outer `{/literal}`.
Empty blocks omit `literal_content`; a standalone closer has its own
`stray_literal_close` node. `_literal_name` is deliberately not an external
token: exposing it in unrelated identifier/recovery positions changed valid
repeated-colon error recovery. Ordinary identifier grammar handles other names.

Fail-first checks were run before grammar edits. Focused
`node --test test/for-loops.test.mjs test/literal-blocks.test.mjs test/loop-metadata.test.mjs`
passes 38/38. The final `npm test` passes all 252 Tree-sitter corpus parses,
354 Node checks, and 18 deliberate mutation checks. `npx tree-sitter test
--include 'repeated colons|Spaced equals' --show-fields` also passes 2/2 after
removing `_literal_name`.

The baseline reports share parser SHA-256
`642a756e6e4ae968c63ac83bdd9043965dc33b5a59a9409c489532370d32b0a9`; their
JSON hashes and counts are listed above. Final after reports have parser SHA-256
`067f647763eb0e99488a80980710df68c2acbf6b23c7d61723e39d8fc99904e0` and were
saved separately outside `build/`:

| Root | After report | Report SHA-256 | Files | Clean / failing |
| --- | --- | --- | ---: | ---: |
| `corpus/application/` | `/tmp/smarty-task029-after-application.json` | `6495906efd5ff5d83bc2bbe5124ce6715150967ff4e20dadc7e9fdc0515420e1` | 467 | 456 / 11 |
| `corpus/upstream-smarty-v5.8.4-core/` | `/tmp/smarty-task029-after-core.json` | `229fb482123da408503af6314c7f05813d0039ae1c59cef3da0be95d505eaf17` | 33 | 24 / 9 |
| `corpus/upstream-smarty-v5.8.4-example/` | `/tmp/smarty-task029-after-example.json` | `ebcc74ffbc188a1580a8472af7765ce19c727f10338b247d1579c007f9abeb93` | 1 | 0 / 1 |

All three after reports match every corresponding baseline source SHA-256.
There are no clean-file regressions or newly clean files. The two affected
application templates, `view_stats/action_chart.tpl` and `view_stats/stats.tpl`,
each drop from three errors to two. Their newly parsed literal blocks contain
exact CSS bytes (415 and 394 bytes respectively), with matching closer ranges;
their remaining errors begin later at `{if $dump_txt neq ''}` and its recovery.
This task does not make either full template error-free. The upstream core and
demo totals are unchanged.

Final source hashes: `grammar.js`
`e7894ed6931f9e5b5976d70ab060a26bbcf422fe6638b817d2c6468ff950e543`,
`src/scanner.c`
`8e586d06c0cf1d0f8a68b03bddb1766d8406074ff90d8d48d5d4ba6c30cdf03a`, and
generated `src/parser.c`
`067f647763eb0e99488a80980710df68c2acbf6b23c7d61723e39d8fc99904e0`.

## Explicit task boundary and queued standard gaps

This task covers default-delimiter literal regions only. Alternate/custom
delimiters and `auto_literal=false` remain a separate standard configuration
task. `{strip}`, inheritance, capture, switch, section blocks/section indices,
other operators and remaining expression forms are also confirmed standard
Smarty gaps for later tasks, not out-of-scope language features. The next
prioritized built-in gap after this one is structural classic `{section}` plus
`[sectionName]` / `[sectionName.property]` indices: the separate current core
report has five failing Section templates (001–004 and 006, each failing first
at a bare section index), and the separately reported demo has two matching
section-index errors on lines 27 and 39. Keep this evidence in the next brief;
do not claim Task 029 covers section syntax. Plugin execution and arbitrary
plugin semantics remain outside the project target.
