# Task 024: Curated upstream Smarty core syntax corpus

**Status:** implementation (brief accepted by independent review 2026-10-01)  
**Type:** corpus provenance and reproducibility; no grammar change  
**Depends on:** none; complete before resuming deferred [Task 016](016-loop-metadata-modifier-argument.md)

## Motivation

The project currently uses its fixed 467-file application corpus as its
real-world completeness signal. It has no small, independently sourced set of
successful Smarty core templates for syntax comparison. Composer distribution
omits Smarty's tests, so the upstream source suite cannot be treated as a
locally available dependency. This task adds a curated, optional local corpus
from the official Smarty v5.8.4 source tests without making CI fetch or vendor
those files.

Pinned source:

- Repository: `https://github.com/smarty-php/smarty`
- Tag: `v5.8.4`
- Commit: `94a27cbbc7820198d7adc17a2be8d457fb267753`
- Relevant source tree: `tests/UnitTests/TemplateSource/`
- The pinned checkout has 361 test `.tpl` files total and 238 below
  `TemplateSource/`; those counts are discovery context, not the chosen corpus
  size or a target to copy wholesale.

## Bounded scope

Select a curated target of **30–50 positive `.tpl` inputs**, only when the
originating upstream test method has a positive successful compile/render
assertion for that exact file. Include at least one qualifying fixture in each
available core family below, and use more than one fixture where it adds a
distinct syntactic form or useful nesting. The final manifest, not these
examples, defines membership.

| Family | Candidate upstream suite / example sources |
| --- | --- |
| Comments | `Comments/CommentsTest.php`, e.g. `Comments/templates/longcomment.tpl` |
| Strings and values | `ValueTests/DoubleQuoted/DoubleQuotedStringTest.php`, e.g. `ValueTests/DoubleQuoted/templates/001_closedBlock.tpl`; eligible single-quoted/value files only where syntax is intrinsic and the assertion succeeds |
| Assignment and output | `TagTests/Assign/CompileAssignTest.php`; eligible ordinary value/output files |
| Conditions | `TagTests/If/CompileIfTest.php` |
| Loops | `TagTests/For/CompileForTest.php`, `TagTests/Foreach/CompileForeachTest.php` |
| Section and capture | `TagTests/Section/CompileSectionTest.php`, `TagTests/Capture/CompileCaptureTest.php` |
| Include, inheritance, blocks | `TagTests/Include/CompileIncludeTest.php`, `TagTests/BockExtend/CompileBlockExtendsTest.php`; retain syntax examples even if the upstream test configures caching, but do not claim cache or graph semantics |
| Literal and whitespace | `TagTests/Literal/LiteralTest.php`, plus eligible spacing/strip cases from built-in suites |

The selection should aim for useful variety rather than equal quotas. Include
at least 24 distinct source files across at least 8 of the listed families,
including comments, strings/values, conditionals, loops, and one of
include/inheritance/capture/section. The remaining slots can extend families
with high-value syntax. Inheritance and include need not be excluded simply
because their upstream successful test configures caching or renders related
templates: include the smallest useful standard syntax members and describe
the parser evidence as syntax-only. Do not include large runtime graphs just to
inflate counts.

Array and operator/value examples are mostly PHP data-provider strings that
upstream writes to temporary templates, rather than checked-in `.tpl` files.
Record eligible provider methods and case identifiers as provenance references
if they help explain the selection, but do not silently call them materialized
corpus members. The selected corpus can include them only if the materializer
can reproduce their exact source deterministically from the pinned checkout
and records both the PHP source hash and extracted-source hash. Prefer checked-
in upstream `.tpl` source files for this first bounded version.

The exact project-owned Task 016 composition
`{foreach $items as $item}{$item|default:$item@index}{/foreach}` is explicitly
excluded from this task's manifest and all upstream-corpus evidence. The pinned
upstream examples have separate foreach-metadata and default-modifier cases;
they do not establish that exact composition. Keep its minimized source and
expectation solely in [Task 016](016-loop-metadata-modifier-argument.md).

### Separate upstream demo example

Include the official demo's `demo/templates/index.tpl` as one separately
identified **example source**, not as a member of the 30–50 positive PHPUnit
fixture set. Its provenance is the pinned checkout at the commit above:

- Template path: `demo/templates/index.tpl`
- Git blob: `1a0f431bb1b1a9f2a8b4a1f2ce36a5913b8074ab`
- SHA-256: `c50433e4a658858ccc5a785bbaf25097512587a7afaab77cb4f2c6d4e419ebea`
- Exercising example: `demo/index.php` (`705478ff332b694d55f8182864371568b691990e`,
  SHA-256 `7a659dfbc0f2bb4a54f2b294aa9a3af1f58afa3c217305d9e309b82f303fc427`)

The demo is useful as a broad syntax example, but its config file, included
header/footer, assigned variables, server/time values, cache setup, and
built-in or plugin-backed handlers are contextual dependencies. Do not assert
successful runtime output, count its referenced files as corpus members, or
use it as positive Smarty compiler evidence. Its report is syntax-only: parse
this exact template independently, or include it in a clearly separate
`examples` report section with its own source hash and error count. Never merge
its metrics into the positive PHPUnit fixture totals or the application corpus
gate. Preserve its separate provenance record and hash validation in the
manifest/materializer.

### Exclusions

- All `X_Scopes` fixtures (10 files) and tests explicitly marked extended.
- Plugin behavior and registration: `BlockPlugin`, `FunctionPlugin`,
  `CompilerPlugin`, `PluginBlock`, `PluginFunction`, and `PluginModifier`
  suites; custom modifier or function behavior.
- Fixtures whose successful result depends on application plugin code,
  arbitrary object methods, custom resources, configured delimiters, security
  policy, request/environment special variables, or generated runtime data.
- Tests whose intended outcome is an exception, syntax error, or failed
  compile, even when their source resembles ordinary syntax.
- Large recursive include or inheritance/runtime graphs when a smaller
  positive built-in syntax example gives equivalent editor evidence.

Built-in tags such as `{include}`, `{block}`, `{extends}`, `{nocache}`, and
`{literal}` are not excluded as syntax. A selected fixture may originate in a
test that also exercises caching; keep the syntax source when it passes and
ignore runtime/cache behavior in this corpus. Never state that the grammar
supports caching, template resolution, block execution, or runtime binding on
the strength of a parse report.

## Manifest and local materialization

Add a tracked machine-readable manifest (JSON or similarly parseable format)
and a local materialization command. Every source entry must record:

- exact upstream repository, tag, and commit;
- source path relative to the upstream checkout;
- Git blob object ID and SHA-256 of the source bytes;
- entry kind (`positive_fixture` or `example`), syntax family, and a short
  inclusion rationale.

Each `positive_fixture` must also identify the test class/file and exact
positive test method (plus provider case ID when relevant), and carry explicit
exclusion flags for runtime/configuration concerns that its test also covers.

Represent the demo entry with a distinct `kind: "example"` (or equivalent)
and its demo-script provenance hashes. It has no PHPUnit method and must not
be represented as one. Store it separately under an ignored
`corpus/upstream-smarty-v5.8.4-example/` path, outside the positive fixture
directory and report section; the Task 016 composition is not a manifest
entry at all.

The materializer must take a caller-supplied local source checkout path. It
must reject a different commit, missing files, changed hashes, path traversal,
duplicate destination names, or an incomplete manifest. It copies only the
manifest members, preserving stable relative names under the ignored
`corpus/upstream-smarty-v5.8.4-core/` and
`corpus/upstream-smarty-v5.8.4-example/` roots according to entry kind. It
must not clone, download, or make any network request. Add the ignored
destination paths to `.gitignore` if needed.
Document one explicit local setup command using the already checked-out source
at the pinned revision; do not require a full upstream Composer install merely
to materialize/report after the selected tests have been independently
verified.

Smarty's upstream license is **LGPL-3.0-or-later**. Do not commit copied
upstream `.tpl` files or excerpts into this project as part of this task. Keep
the tracked manifest limited to provenance and hashes, add a concise
attribution/license notice identifying the upstream project and license, and
leave materialized source in the ignored directory. If a later task proposes
copying any upstream text into tracked tests, it must make a separate
attribution and license-compatibility review before doing so.

## Failing checks first

Before adding the materializer/report implementation, add a Node test that
fails for the absent manifest/materializer behavior. Cover at least:

1. A valid pinned checkout and valid hashes materialize exactly the manifest
   entries under the ignored destination.
2. Wrong commit, edited source bytes, missing files, and duplicate/escaping
   paths fail with a clear error and do not leave a partial corpus.
3. A clean/incomplete manifest is handled deterministically; repeated runs at
   the same pinned source produce the same destination paths and hashes.
4. The report command accepts the materialized directory explicitly and does
   not substitute it for, rewrite, or change the fixed application corpus.

Do not add upstream source templates or hand-authored expected trees to this
task. This creates optional external source evidence only; syntax support still
requires future bounded briefs with manually specified Tree-sitter trees.

## Acceptance and evidence

- Freeze the positive-fixture manifest set at 30–50 source files, at least 24
  distinct physical files and at least 8 core families, meeting the family
  minimums above. Every fixture row has complete source hash and successful
  test provenance. Remove any candidate that cannot be tied to a passing
  assertion; do not replace it with a negative test fixture. Validate and
  report the demo separately using the pinned hashes; it does not affect those
  counts.
- Run each named upstream PHPUnit test or an equivalent pinned upstream test
  command and record the exact command and result. If the checkout lacks test
  dependencies and that run cannot be performed, state that limitation; do not
  describe candidates as newly verified. Where available, run every selected
  source through the local Smarty reference adapter and require no compiler
  error. The adapter establishes syntax acceptance and limited event/order
  observations, not expression values, runtime behavior, or structure.
- Materialize from a local checkout at the pinned commit and report its file
  count and aggregate source hashes. The manifest and hash checks make this
  reproducible without network access.
- Run the parser corpus reporter explicitly on the materialized directory;
  save JSON outside `build/` and report grammar hash, source hashes, totals,
  parse-error counts, and per-file errors. Keep this auxiliary report separate
  from the 467-file application-corpus gate and do not treat either corpus as a
  replacement for the other. Report the demo in its own section or command and
  do not aggregate its syntax-only result with positive PHPUnit fixtures.
- Inspect every upstream-corpus file that changes from parse-error to clean.
  Confirm the parse tree contains expected structured syntax rather than text
  swallowing. Record the inspected paths and summary; a zero-error result alone
  does not establish support.
- Update `docs/features.md` with a clearly labeled auxiliary upstream evidence
  source and its limits, preserving all existing feature rows/statuses. Update
  `test/CONTRACT.md` only if needed to explain how this optional corpus report
  relates to syntax evidence; do not weaken or replace the application-corpus
  contract.
- `npm test` passes, including the new materializer checks. Public CI does not
  download or require the upstream checkout or the ignored corpus. Do not
  regenerate expected trees, alter grammar behavior, start Task 016, or claim
  project/corpus completion in this task.

## Handoff

Report the manifest path and selected file/family counts, upstream test
commands and limitations, local materialization command, corpus report path
and grammar/source hashes, newly clean files structurally inspected, licensing
notice, CI independence, and any eligible upstream families left without
physical fixtures (including inline-only value/operator cases). Keep Task 016
deferred until this corpus source is reviewable. Identify the demo example and
its separate report, and confirm the Task 016 composition was not used as
upstream evidence.

## Implementation evidence (2026-10-01)

**Status:** complete (independent implementation review accepted 2026-10-01).

The independent reviewer reproduced the nine pinned PHPUnit commands (46 tests,
56 assertions), all 33 local SyntaxRecorder checks, materialization and report
hashes, the fixed application corpus file/hash set, `npm test` (300 checks and
14 deliberate mutations), and `git diff --check`. No blockers were found.

The tracked manifest is `test/upstream-smarty-v5.8.4/manifest.json`: 33
positive fixtures, 33 distinct physical `.tpl` files, and 11 syntax families.
The selected families are comments, strings/values, conditionals, loops,
literal/whitespace, section, capture, include, assignment/output,
inheritance/blocks, and template functions. `LiteralTest` has inline
temporary-template inputs rather than a qualifying checked-in positive `.tpl`,
so no literal-tag file was materialized; literal/whitespace coverage is from
the selected `{strip}` fixture. The exact Task 016 composition was checked
against upstream tests and is absent; separate modifier and loop-metadata
cases do not verify their composition.

The upstream checkout was at commit
`94a27cbbc7820198d7adc17a2be8d457fb267753`. Its temporary Composer development
dependency installation succeeded. These selected PHPUnit commands passed
46 tests / 56 assertions in total:

```text
php vendor/bin/phpunit --filter 'testTextComment5' tests/UnitTests/TemplateSource/Comments/CommentsTest.php (1 test, 1 assertion)
php vendor/bin/phpunit --filter 'testDoubleQuotedClosedBlock_001' tests/UnitTests/TemplateSource/ValueTests/DoubleQuoted/DoubleQuotedStringTest.php (1/1)
php vendor/bin/phpunit --filter 'testRecursiveFunction|testSimpleFunction_001|testSimpleFunctionCached_002|testSimpleFunctionTag2' tests/UnitTests/TemplateSource/TagTests/TemplateFunction/CompileFunctionTest.php (8/8)
php vendor/bin/phpunit --filter 'testForeach(Nested_27|NestedNamed_28|Break_29|Break_30|Break_31|Continue_32|Continue_33|Continue_34|Continue_35)' tests/UnitTests/TemplateSource/TagTests/Foreach/CompileForeachTest.php (9/9)
php vendor/bin/phpunit --filter 'testSection_(001|002|003|004|006|007)' tests/UnitTests/TemplateSource/TagTests/Section/CompileSectionTest.php (6/6)
php vendor/bin/phpunit --filter 'testCapture9|testCapture10' tests/UnitTests/TemplateSource/TagTests/Capture/CompileCaptureTest.php (2 tests, 4 assertions)
php vendor/bin/phpunit --filter 'testIncludeStandard_001|testIncludeAssign1|testIncludeAssign2' tests/UnitTests/TemplateSource/TagTests/Include/CompileIncludeTest.php (6/6)
php vendor/bin/phpunit --filter 'testIncludePassVars' tests/UnitTests/TemplateSource/TagTests/Include/CompileIncludeTest.php (4/4)
php vendor/bin/phpunit --filter 'testCompileBlockParent_001|testCompileBlockChild_002' tests/UnitTests/TemplateSource/TagTests/BockExtend/CompileBlockExtendsTest.php (9 tests, 17 assertions)
```

All 33 materialized positive files were also accepted by the local Smarty
SyntaxRecorder. It bypasses plugin execution and compiler block validation;
its evidence is syntax acceptance with limited event/order projection, not
runtime behavior or complete expression structure. There are no committed
upstream template contents. Run the local materializer with a checkout already
at the pinned commit:

```text
node scripts/materialize-upstream-corpus.mjs /path/to/smarty-checkout
```

It validates the checkout commit, manifest membership digest, source Git blob
and SHA-256 hashes, test and license provenance, path safety, and family/count
minimums before writing. The Node checks cover wrong revisions, edited or
missing inputs, duplicate and escaping destinations, incomplete manifests,
repeat-run stability, and separation from application reporting. Attribution
is in `test/upstream-smarty-v5.8.4/NOTICE.md`; outputs are ignored. Public CI
does not fetch the checkout or require materialized files.

Reports were saved outside `build/`:

| Source | Report | Files | Clean / errors | Parser SHA-256 | Source manifest SHA-256 |
| --- | --- | ---: | ---: | --- | --- |
| Upstream positive core | `/tmp/smarty-task024-upstream-core-report.json` | 33 | 19 / 14 | `04cafb5d5214b5de784cb156a80d55adf69f92ff7a8f24dec7194d9bbdf27255` | `e4c1b3827c06b5d4b9e02fd98bcb422f86db43c9ee86e663f6bc3334e5715a0d` |
| Separate official demo | `/tmp/smarty-task024-upstream-demo-report.json` | 1 | 0 / 1 | `04cafb5d5214b5de784cb156a80d55adf69f92ff7a8f24dec7194d9bbdf27255` | `86bec9d2b8cb56b7e93e20f96c8d4dff3385bbae3d24ceb237b561697f66fdc1` |
| Fixed application corpus | `/tmp/smarty-task024-app-report.json` | 467 | 449 / 18 | `04cafb5d5214b5de784cb156a80d55adf69f92ff7a8f24dec7194d9bbdf27255` | `f87edb1ebadbee2f610ce3eb4cfe9207585f86da34e589a71aef73d5223a2c5e` |

The source-manifest digest is SHA-256 over the report's sorted `path`, NUL,
file-SHA-256, newline records. All 467 per-file path/hash pairs in the new
application report match `/tmp/smarty-013-after.json`; only the grammar hash
and parse results reflect the current parser.

Corpus roots are kept separate on disk: the application templates are under
`corpus/application/`, the selected Smarty test fixtures under
`corpus/upstream-smarty-v5.8.4-core/`, and the demo under
`corpus/upstream-smarty-v5.8.4-example/`. The default reporter reads only the
application root; the two upstream reports use explicit source paths. This
organization change preserves the upstream output paths and does not alter the
recorded Task 024 parser evidence or source hashes.

All 19 clean core files were structurally inspected. Their parse-tree observations:

- `TemplateSource/Comments/templates/longcomment.tpl`: explicit comment node.
- `TemplateSource/ValueTests/DoubleQuoted/templates/001_closedBlock.tpl`:
  explicit output/string nodes.
- `TemplateSource/TagTests/Foreach/templates/029_foreach.tpl` and
  `032_foreach.tpl`: explicit foreach and nested if nodes; break/continue
  remain generic tags.
- `TemplateSource/TagTests/TemplateFunction/templates/test_template_function_tag4.tpl`:
  explicit if structure; function tags remain generic.
- `TemplateSource/TagTests/BockExtend/templates/001_parent.tpl` and
  `002_child.tpl`: inheritance and blocks remain generic tags.
- `TemplateSource/TagTests/Capture/templates/009_capture_include.tpl`,
  `009_capture.tpl`, and `010_capture.tpl`: capture tags remain generic;
  output expression detail is retained.
- `TemplateSource/TagTests/Include/templates/helloworld.tpl`,
  `test_include_assign1.tpl`, `test_include_assign2.tpl`,
  `test_include_pass_vars.tpl`, `test_include_pass_vars2_sub.tpl`, and
  `test_include_standard.tpl`: include/assign forms remain generic tags with
  their text, attributes, and output expressions retained.
- `TemplateSource/TagTests/Section/templates/007_section.tpl`: section tags
  remain generic.
- `TemplateSource/TagTests/TemplateFunction/templates/test_template_function_001.tpl`
  and `test_template_function_tag2.tpl`: function tags remain generic.

The 14 parser-error source paths are leads, not diagnoses; hints and snippets
are lexical triage only. The saved report has exact ranges/snippets:

- `TemplateSource/TagTests/BockExtend/templates/002_parent.tpl` — first error
  line 1, column 7, `{$test nocache}`.
- `TemplateSource/TagTests/Foreach/templates/027_foreach.tpl` — line 2,
  column 1; snippet begins `{strip}` and nested metadata examples.
- `TemplateSource/TagTests/Foreach/templates/028_foreach.tpl` — line 2,
  column 1, legacy `from=/item=/key=` form; second error line 5, column 1.
- `TemplateSource/TagTests/Foreach/templates/030_foreach.tpl`,
  `031_foreach.tpl`, `033_foreach.tpl`, `034_foreach.tpl`, and
  `035_foreach.tpl` — line 2, column 1; snippets begin with `{for ...}` and
  nested foreach, with later break/continue cases in the source.
- `TemplateSource/TagTests/Section/templates/001_section.tpl` — line 1,
  column 29 at the bracket section index; `002_section.tpl` — line 1,
  column 38; `003_section.tpl` and `004_section.tpl` — line 1, column 29;
  `006_section.tpl` — line 1, column 29, with later section metadata.
- `TemplateSource/TagTests/TemplateFunction/templates/test_template_function_002.tpl`
  — line 1, column 55 near `{$param nocache}`.

Inventory mapping: loop metadata as primary expressions is already covered by
Task 012; direct metadata as a modifier argument is the known Task 015 gap and
belongs only to deferred Task 016 (not evidenced by this manifest). The
foreach failures also suggest separate legacy-foreach, `{for}`, and break/
continue questions; these are not established diagnoses. Section syntax and
`nocache`/inheritance structure are not modeled in the current feature inventory
beyond the “other built-in blocks” gap. Task 005 covers comparison operators;
the snippets alone do not show that comparisons cause the foreach failures.
Task 011 covers function calls generally, but does not establish the exact
template-function form in the failing file. Capture/include/inheritance
selected successes likewise remain generic-tag evidence, not block support.

The initial failure-first Node test failed because the materializer module was
absent. After implementation, `node --test test/upstream-corpus.test.mjs`
passed 4/4 checks. The final `npm test` passed all 300 Node checks and caught
all 14 deliberate grammar mutations. The three corpus reports above were
regenerated after the acceptance gate; the application report retains the same
467 source manifest hash and 449/18 clean/error totals. No grammar or expected
tree files changed. Task 016 remains deferred.
