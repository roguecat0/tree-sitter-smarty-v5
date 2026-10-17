/**
 * @file Initial Smarty 5 subset for tree-sitter (grammar name: smarty_v5)
 * @author roguecat0 <roguecat0@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Explicit keyword spellings cooperate with Tree-sitter's word token: a longer
// identifier such as TRUEish must win, and contextual names remain identifiers.
/** @param {string} word */
const cases = word => [...word].reduce((forms, ch) => forms.flatMap(form => [form + ch, form + ch.toUpperCase()]), /** @type {string[]} */ ([""]));
const primitiveWords = [...cases("true"), ...cases("false"), ...cases("null")];
const controlWords = ["if", "else", "elseif", "foreach", "foreachelse", "for", "forelse", "section", "sectionelse"];
const classReservedWords = [...cases("self"), ...cases("parent")];

export default grammar({
  name: "smarty_v5",
  externals: $ => [
    $.text, $._output_attribute_error_marker, $._tag_attribute_output_space, $._tag_attribute_output_start,
    $._if_header_close_recovery, $._output_nocache_name,
    $.string_fragment, $._quoted_comment_start, $._backtick_interpolation_start,
    $._literal_opener, $.literal_content, $.literal_close_tag,
    $._word_and_operator, $._word_or_operator, $._word_xor_operator,
    $._word_equality_operator, $._word_relational_operator,
    $._bracket_braced_index_open, $.single_condition_operator,
  ],
  extras: _ => [/\s/],
  word: $ => $.identifier,
  reserved: {
    global: _ => controlWords,
    tag: _ => [...controlWords, ...primitiveWords],
    property: _ => [],
    class: _ => classReservedWords,
  },
  conflicts: $ => [[$.elseif_clause], [$.else_clause], [$.foreachelse_clause], [$.forelse_clause], [$.sectionelse_clause]],
  rules: {
    source_file: $ => repeat($._node),
    _node: $ => choice($.text, $.output, $.assignment_tag, $.assignment_recovery, $.custom_tag, $.custom_close_tag, $.if_block, $.comment, $.foreach_block, $.for_block, $.section_block, $.literal_block, $.stray_literal_close),
    literal_block: $ => prec(-20, seq(
      $.literal_tag,
      optional(field("content", $.literal_content)),
      $.literal_close_tag,
    )),
    literal_tag: $ => seq("{", $._literal_opener),
    stray_literal_close: $ => seq("{/", token.immediate(prec(10, choice(...cases("literal")))), token.immediate("}")),
    // A single token hides all template syntax and stops at the first *}.
    // Star runs cannot consume a closing brace; the following newline is text.
    comment: _ => token(seq("{*", /([^*]|\*+[^*}])*/, /\*+/, "}")),
    // Smarty's `{ $target = value }` shorthand compiles to the built-in assign
    // tag. Keep its target distinct from the full expression on the right;
    // assignment itself is not an expression operator and emits no output.
    assignment_tag: $ => prec.dynamic(20, seq(
      "{", field("target", choice($.variable, $.index_expression)), "=",
      field("value", $._expression),
      repeat(alias($._assignment_nocache_option, $.attribute)), "}",
    )),
    _assignment_nocache_option: $ => seq(
      field("name", alias("nocache", $.identifier)), optional(seq("=", field("value", $._tag_attribute_value))),
    ),
    // Keep malformed shorthand tags local and navigable. These recovery paths
    // deliberately end at the assignment's own brace; the hidden marker forces
    // Tree-sitter to retain a real parse error while leaving surrounding nodes
    // such as comments, later output, and block closers outside the error span.
    assignment_recovery: $ => choice(
      prec(100, seq("{", $.variable, "=", "}", $._output_attribute_error_marker)),
      prec(100, seq("{", $.variable, $.variable, "}", $._output_attribute_error_marker)),
      prec(100, seq("{", seq($.variable, "[", "=", $._expression), "}", $._output_attribute_error_marker)),
      prec(100, seq("{", seq($.member_expression, "=", $._expression), "}", $._output_attribute_error_marker)),
    ),
    output: $ => choice(
      // A no-source external marker forces a parse error after this explicit
      // recovery node without making any input spelling valid.
      // Smarty's `outattr` suffix is deliberately limited here to nocache;
      // assign/nofilter and arbitrary attributes have separate contracts.
      // This shared expression path mirrors `outattr ::= output attributes`
      // while the explicit function-call error alternative preserves useful
      // recovery for compiler-invalid named output attributes.
      prec(-1, seq("{", field("value", $._output_nocache_value), repeat1(alias($._output_nocache_attribute, $.attribute)), "}")),
      prec(9, seq("{", field("value", $.function_call_expression), alias(repeat1(alias($._builtin_attribute, $.attribute)), "ERROR"), $._output_attribute_error_marker, "}")),
      prec(9, seq("{", field("value", $.function_call_expression), "}")),
      seq("{", field("value", $._expression), "}"),
    ),
    // These names are valid custom tags, but not static class receivers.
    // Explicit tokens let the class-only reserved set reject exact spellings.
    // A bare-ID output can resemble `{name}`; prefer the established custom-tag
    // interpretation when the ID occupies the entire brace body.
    _tag_name: $ => prec(1, choice(
      reserved("tag", $.identifier),
      $._not_identifier,
      alias(choice(...classReservedWords), $.identifier),
      // The pinned Smarty ID token may start with digits; preserve that token
      // as a tag name at brace-root level instead of reclassifying it as output.
      alias($._modifier_identifier, $.identifier),
    )),
    custom_tag: $ => seq("{", field("name", $._tag_name), repeat(choice(
      $.attribute, field("argument", $._tag_argument_value),
    )), "}"),
    custom_close_tag: $ => seq("{/", field("name", $.identifier), "}"),
    // Support common hyphenated, single-colon, and digit-prefixed ATTR names
    // locally in this field; ordinary names keep their existing node shape.
    _attribute_name: $ => choice(
      $.identifier, $._not_identifier, alias($.boolean, $.identifier), alias($.null, $.identifier), $.tag_attribute_name,
      // These words are reserved in tag roots or class receivers, but Smarty
      // accepts them as ordinary names in the generic attribute slot.
      alias(choice(...controlWords, ...classReservedWords), $.identifier),
    ),
    attribute: $ => seq(
      field("name", $._attribute_name), "=",
      choice(
        seq(
          $._tag_attribute_output_space,
          field("value", alias($._braced_output_expression, $.output)),
        ),
        field("value", choice(
          prec(2, alias($._braced_output_expression, $.output)),
          $._tag_attribute_value,
        )),
      ),
    ),
    _builtin_attribute: $ => seq(field("name", $._attribute_name), "=", field("value", $._tag_attribute_value)),
    _output_nocache_attribute: $ => seq(
      field("name", alias($._output_nocache_name, $.identifier)),
      optional(seq("=", field("value", $._expression))),
    ),
    // Keep bare static identifiers available to generic tags such as
    // `{widget nocache}`. These suffix-only aliases extend supported output
    // expressions without broadening the separate bracket-index value rule.
    _output_nocache_value: $ => choice(
      $._index_value, $.section_property_expression, $.boolean, $.null,
      alias($._bitwise_and_expression, $.binary_expression),
      alias($._word_equality_expression, $.binary_expression),
      alias($._word_relational_expression, $.binary_expression),
      alias($._div_by_expression, $.binary_expression),
    ),
    tag_attribute_name: _ => token(choice(
      /[0-9]+[a-zA-Z_][a-zA-Z0-9_-]*(?::[a-zA-Z0-9_-]+)*/,
      /[a-zA-Z_][a-zA-Z0-9_-]*-[a-zA-Z0-9_-]*(?::[a-zA-Z0-9_-]+)*/,
      /[a-zA-Z_][a-zA-Z0-9_-]*:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*/,
    )),
    // Smarty's tag value productions accept a direct ID in these two tag-only
    // positions. Keep it out of _expression so a bare name does not become a
    // general value in outputs, conditions, or other expression contexts.
    _tag_argument_value: $ => choice(
      prec(1, $._expression), prec(-1, $.identifier), prec(-1, $._not_identifier), prec(-1, alias($._modifier_identifier, $.identifier)),
    ),
    _tag_attribute_value: $ => choice(
      prec(1, $._expression), prec(-1, $.identifier), prec(-1, $._not_identifier), prec(-1, alias($._modifier_identifier, $.identifier)),
    ),
    // Braced Smarty expressions in an attribute or bracket index use a nested
    // output node. The opener token rejects the auto-literal `{ ` form; the
    // attribute-only gap token separately allows whitespace after `=`.
    _braced_output_expression: $ => seq(
      $._tag_attribute_output_start,
      field("value", $._expression),
      "}",
    ),
    _braced_index_output_expression: $ => seq(
      "{",
      field("value", $._expression),
      "}",
    ),
    if_block: $ => seq(
      $.if_tag, repeat($._node), repeat($.elseif_clause), optional($.else_clause), $.if_close_tag,
    ),
    if_tag: $ => choice(
      seq("{", "if", field("condition", $._if_expression), "}"),
      prec(-100, seq("{", "if", field("condition", $._if_expression), alias($._if_header_close_recovery, $.string_fragment))),
    ),
    elseif_clause: $ => seq($.elseif_tag, repeat($._node)),
    elseif_tag: $ => choice(
      seq("{", "elseif", field("condition", $._if_expression), "}"),
      // Smarty's spaced alias is the exact lowercase token `else if` with one
      // ASCII space. Keep it atomic so grammar extras cannot normalize tabs,
      // newlines, or repeated spaces into this branch spelling.
      seq("{", token(prec(2, "else if")), field("condition", $._if_expression), "}"),
    ),
    else_clause: $ => seq($.else_tag, repeat($._node)),
    else_tag: _ => seq("{", "else", "}"),
    if_close_tag: _ => seq("{/", "if", "}"),
    foreach_block: $ => seq($.foreach_tag, repeat($._node), optional($.foreachelse_clause), $.foreach_close_tag),
    foreach_tag: $ => choice(
      // A sequence ending in contextual `as` is the modern binding form; give
      // it priority over the otherwise permissive positional legacy list.
      prec.dynamic(20, seq(
        "{", "foreach", token.immediate(/\s+/), field("source", $._expression),
        // Smarty requires whitespace around contextual `as`; generic tag names
        // and keyword-named properties keep their ordinary identifier behavior.
        alias(token.immediate(prec(2, /\s+as\s+/)), "as"),
        optional(seq(field("key", $.variable), "=>")), field("item", $.variable),
        // Modern binding headers accept the same ordinary trailing attributes
        // and bare option flags as legacy headers. Keep them as direct, ordered
        // children after the synthesized source/key/item fields.
        repeat(choice(alias($._builtin_attribute, $.attribute), alias($.foreach_nocache_attribute, $.attribute), $.foreach_option)), "}",
      )),
      // Tree-sitter cannot create a named node from an empty repeat; an empty
      // legacy list is therefore represented by the absence of a header node.
      seq("{", "foreach", optional(token.immediate(/\s+/)), "}"),
      seq("{", "foreach", alias(repeat1(seq(
        token.immediate(/\s+/),
        choice(alias($._builtin_attribute, $.attribute), alias($.foreach_nocache_attribute, $.attribute), $.foreach_option, field("argument", $._legacy_foreach_argument)),
      )), $.legacy_foreach_header), "}"),
    ),
    _legacy_foreach_argument: $ => $._tag_attribute_value,
    // A dedicated alternative shares the `nocache` token with the bare option.
    // The following `=` distinguishes a valued attribute, whose public shape
    // is still the same name/value fields as every other attribute. Consume
    // optional spacing immediately after the keyword so the option token does
    // not win before a separated equals sign.
    foreach_nocache_attribute: $ => prec(1, seq(
      field("name", alias("nocache", $.identifier)), optional(token.immediate(/\s+/)), "=",
      field("value", $._tag_attribute_value),
    )),
    foreach_option: _ => "nocache",
    foreachelse_clause: $ => seq($.foreachelse_tag, repeat($._node)),
    foreachelse_tag: _ => seq("{", "foreachelse", "}"),
    foreach_close_tag: _ => seq("{/", "foreach", "}"),
    for_block: $ => seq($.for_tag, repeat($._node), optional($.forelse_clause), $.for_close_tag),
    for_tag: $ => seq("{", "for", choice($.range_for_header, $.c_style_for_header), "}"),
    range_for_header: $ => seq(
      field("target", $._for_target), "=", field("start", $._expression), alias(token(prec(2, /[tT][oO]/)), "to"),
      field("end", $._expression),
      optional(seq("step", field("step", $._expression))),
      repeat(choice(
        seq("max", "=", field("max", $._expression)),
        alias($._builtin_attribute, $.attribute),
        $.for_option,
        field("argument", $._for_bare_argument),
      )),
      optional(field("argument", alias("step", $.identifier))),
    ),
    c_style_for_header: $ => choice(
      seq(
        field("initializer", $.for_initializer), repeat(seq(",", field("initializer", $.for_initializer))),
        ";", field("condition", $._expression), ";", field("update", $.for_update),
        repeat(choice(alias($._builtin_attribute, $.attribute), $.for_option, field("argument", $._for_bare_argument))),
        optional(field("argument", alias("step", $.identifier))),
      ),
      // Keep the loop boundary navigable when the C-style condition is omitted.
      // The impossible marker forces a real parse error after consuming the
      // malformed header, allowing for_block to retain its body and closer.
      prec(-1, seq(
        field("initializer", $.for_initializer), repeat(seq(",", field("initializer", $.for_initializer))),
        ";", ";", field("update", $.for_update),
        repeat(choice(alias($._builtin_attribute, $.attribute), $.for_option, field("argument", $._for_bare_argument))),
        optional(field("argument", alias("step", $.identifier))),
        $._output_attribute_error_marker,
      )),
    ),
    for_initializer: $ => seq(field("target", $._for_target), "=", field("value", $._expression)),
    for_update: $ => seq(
      field("target", $._for_target),
      choice(
        field("operator", choice("++", "--")),
        seq("=", field("value", $._expression)),
      ),
    ),
    _for_target: $ => choice($.variable, $.index_expression, alias($._config_index, $.index_expression)),
    _for_bare_argument: $ => $.identifier,
    for_option: _ => "nocache",
    forelse_clause: $ => seq($.forelse_tag, repeat($._node)),
    forelse_tag: _ => seq("{", "forelse", "}"),
    for_close_tag: _ => seq("{/", "for", "}"),
    // Section blocks use the same recursive ownership model as other built-in
    // blocks. The grammar associates each sectionelse with the innermost
    // section whose close has not yet been consumed.
    section_block: $ => seq($.section_tag, repeat($._node), optional($.sectionelse_clause), $.section_close_tag),
    section_tag: $ => seq("{", "section", token.immediate(/\s+/), $.section_header, "}"),
    section_header: $ => choice(
      // Long form supports either order for required fields and keeps option
      // attributes where they appeared in the source.
      seq(repeat($._section_option), field("name", $.section_header_name), repeat($._section_option), field("loop", $.section_header_loop), repeat($._section_option)),
      seq(repeat($._section_option), field("loop", $.section_header_loop), repeat($._section_option), field("name", $.section_header_name), repeat($._section_option)),
      // Short form is the positional name/loop pair followed by options.
      prec.dynamic(3, seq(
        field("name", $.section_header_name),
        token.immediate(/\s+/),
        field("loop", $.section_header_loop),
        repeat($._section_option),
      )),
    ),
    section_header_name: $ => choice(seq("name", "=", field("value", $.identifier)), prec(4, seq(field("value", $.identifier)))),
    section_header_loop: $ => choice(seq("loop", "=", field("value", $._expression)), field("value", $._expression)),
    _section_option: $ => choice(alias($._builtin_attribute, $.attribute), $.section_option),
    section_option: _ => "nocache",
    sectionelse_clause: $ => seq($.sectionelse_tag, repeat($._node)),
    sectionelse_tag: _ => seq("{", "sectionelse", "}"),
    section_close_tag: _ => seq("{/", "section", "}"),
    // Conditions admit a complete braced expression as a primary operand.
    // Keep this ladder local to if/elseif so the wrapper does not broaden
    // unrelated expression contexts such as unknown-tag values or outputs.
    _if_expression: $ => $._if_logical_or,
    _if_logical_or: $ => choice($._if_logical_and, alias($._if_or_expression, $.binary_expression), alias($._if_word_or_expression, $.binary_expression), alias($._if_xor_expression, $.binary_expression)),
    _if_xor_expression: $ => prec.left(-6, seq(
      field("left", $._if_logical_or), field("operator", alias($._word_xor_operator, $.word_operator)),
      field("right", $._if_logical_or),
    )),
    _if_or_expression: $ => prec.left(-5, seq(field("left", $._if_logical_or), field("operator", "||"), field("right", $._if_logical_and))),
    _if_word_or_expression: $ => prec.left(-5, seq(
      field("left", $._if_logical_or), field("operator", alias($._word_or_operator, $.word_operator)),
      field("right", $._if_logical_and),
    )),
    _if_logical_and: $ => choice($._if_bitwise_and, alias($._if_and_expression, $.binary_expression), alias($._if_word_and_expression, $.binary_expression)),
    _if_and_expression: $ => prec.left(-4, seq(field("left", $._if_logical_and), field("operator", "&&"), field("right", $._if_bitwise_and))),
    _if_word_and_expression: $ => prec.left(-4, seq(
      field("left", $._if_logical_and), field("operator", alias($._word_and_operator, $.word_operator)),
      field("right", $._if_bitwise_and),
    )),
    _if_bitwise_and: $ => choice($._if_equality, alias($._if_bitwise_and_expression, $.binary_expression)),
    _if_bitwise_and_expression: $ => prec.left(-3, seq(field("left", $._if_bitwise_and), field("operator", "&"), field("right", $._if_equality))),
    _if_equality: $ => choice($._if_relational, alias($._if_equality_expression, $.binary_expression), alias($._if_word_equality_expression, $.binary_expression)),
    _if_equality_expression: $ => prec(-2, seq(
      field("left", $._if_relational), field("operator", choice("==", "!=", "===", "!==")), field("right", $._if_relational),
    )),
    _if_word_equality_expression: $ => prec(-2, seq(
      field("left", $._if_relational), field("operator", alias($._word_equality_operator, $.word_operator)), field("right", $._if_relational),
    )),
    _if_relational: $ => choice($._if_arithmetic, alias($._if_relational_expression, $.binary_expression), alias($._if_word_relational_expression, $.binary_expression)),
    _if_relational_expression: $ => prec(-1, seq(field("left", $._if_arithmetic), field("operator", choice("<", "<=", ">", ">=")), field("right", $._if_arithmetic))),
    _if_word_relational_expression: $ => prec(-1, seq(
      field("left", $._if_arithmetic), field("operator", alias($._word_relational_operator, $.word_operator)), field("right", $._if_arithmetic),
    )),
    _if_arithmetic: $ => choice($._if_multiplicative, alias($._if_additive_expression, $.binary_expression), alias($._if_div_by_expression, $.binary_expression), alias($._if_parity_by_expression, $.binary_expression), alias($._if_single_condition_expression, $.single_condition_expression)),
    _if_additive_expression: $ => prec.left(1, seq(field("left", $._if_arithmetic), field("operator", choice("+", "-")), field("right", $._if_multiplicative))),
    _if_multiplicative: $ => choice($._if_unary, alias($._if_multiplicative_expression, $.binary_expression)),
    _if_multiplicative_expression: $ => prec.left(2, seq(field("left", $._if_multiplicative), field("operator", choice("*", "/", "%")), field("right", $._if_unary))),
    _if_div_by_expression: $ => prec.left(0, seq(
      field("left", $._if_arithmetic), field("operator", $.div_by_operator), token.immediate(/\s+/), field("right", $._if_unary),
    )),
    _if_parity_by_expression: $ => prec.left(0, seq(
      field("left", $._if_arithmetic), field("operator", $.parity_by_operator), field("right", $._if_unary),
    )),
    // Keep the required leading separator outside the public operator node;
    // making it immediate preserves Smarty's whitespace token boundary.
    _if_single_condition_expression: $ => prec.left(0, seq(
      field("left", $._if_arithmetic), field("operator", $.single_condition_operator),
    )),
    _if_unary: $ => choice($._if_modified, alias($._if_not_expression, $.unary_expression), alias($._if_sign_expression, $.unary_expression), alias($._if_word_not_expression, $.unary_expression)),
    _if_not_expression: $ => prec(3, seq(field("operator", "!"), field("argument", $._if_unary))),
    _if_sign_expression: $ => prec(3, seq(field("operator", choice("+", "-")), choice(
      field("argument", choice($._if_modified, alias($._if_not_expression, $.unary_expression))),
      seq(token.immediate(/\s+/), field("argument", $._if_unary)),
    ))),
    _if_word_not_expression: $ => prec(3, seq(
      field("operator", alias(token(/[nN][oO][tT]/), $.word_operator)),
      token.immediate(/[\t \r\n\v\f]+/), field("argument", $._if_unary),
    )),
    _if_modified: $ => choice($._if_primary, $.modifier_expression, $.typecast_expression),
    _if_primary: $ => choice(
      // Smarty rejects the auto-literal `{ ` spelling. Consume this exact
      // boundary as a local parse error instead of letting global extras
      // silently skip the inner space and accept it as an expression wrapper.
      prec(100, alias($._if_braced_expression_with_inner_space, $.output)),
      prec.dynamic(10, alias($._if_braced_expression, $.output)),
      $._primary,
    ),
    _if_braced_expression_with_inner_space: $ => seq(
      "{", token.immediate(/[\t \r\n\v\f]+/), field("value", $._expression), "}",
      $._output_attribute_error_marker,
    ),
    _if_braced_expression: $ => seq("{", field("value", $._expression), "}"),
    _expression: $ => $._logical_or,
    // PHP binds word `xor` below `or`; `and`/`or` share the corresponding
    // symbolic logical levels. Smarty's lexer requires surrounding whitespace
    // for SLOGOP; the operator node retains only the source spelling.
    _logical_or: $ => choice($._logical_and, alias($._or_expression, $.binary_expression), alias($._word_or_expression, $.binary_expression), alias($._xor_expression, $.binary_expression)),
    _xor_expression: $ => prec.left(-6, seq(
      field("left", $._logical_or), field("operator", alias($._word_xor_operator, $.word_operator)),
      field("right", $._logical_or),
    )),
    // Layer comparison operands so an unparenthesized second comparison cannot
    // silently acquire associativity. Aliases preserve the public binary tree.
    _or_expression: $ => prec.left(-5, seq(field("left", $._logical_or), field("operator", "||"), field("right", $._logical_and))),
    _word_or_expression: $ => prec.left(-5, seq(
      field("left", $._logical_or), field("operator", alias($._word_or_operator, $.word_operator)),
      field("right", $._logical_and),
    )),
    _logical_and: $ => choice($._bitwise_and, alias($._and_expression, $.binary_expression), alias($._word_and_expression, $.binary_expression)),
    _and_expression: $ => prec.left(-4, seq(field("left", $._logical_and), field("operator", "&&"), field("right", $._bitwise_and))),
    _word_and_expression: $ => prec.left(-4, seq(
      field("left", $._logical_and), field("operator", alias($._word_and_operator, $.word_operator)),
      field("right", $._bitwise_and),
    )),
    _bitwise_and: $ => choice($._equality, alias($._bitwise_and_expression, $.binary_expression)),
    _bitwise_and_expression: $ => prec.left(-3, seq(field("left", $._bitwise_and), field("operator", "&"), field("right", $._equality))),
    _equality: $ => choice($._relational, alias($._equality_expression, $.binary_expression), alias($._word_equality_expression, $.binary_expression)),
    _equality_expression: $ => prec(-2, seq(
      field("left", $._relational), field("operator", choice("==", "!=", "===", "!==")), field("right", $._relational),
    )),
    _word_equality_expression: $ => prec(-2, seq(
      field("left", $._relational), field("operator", alias($._word_equality_operator, $.word_operator)), field("right", $._relational),
    )),
    _relational: $ => choice($._arithmetic, alias($._relational_expression, $.binary_expression), alias($._word_relational_expression, $.binary_expression)),
    _relational_expression: $ => prec(-1, seq(field("left", $._arithmetic), field("operator", choice("<", "<=", ">", ">=")), field("right", $._arithmetic))),
    _word_relational_expression: $ => prec(-1, seq(
      field("left", $._arithmetic), field("operator", alias($._word_relational_operator, $.word_operator)), field("right", $._arithmetic),
    )),
    _arithmetic: $ => choice($._unary, $.binary_expression, alias($._div_by_expression, $.binary_expression), alias($._parity_by_expression, $.binary_expression), $.single_condition_expression),
    // Match Smarty's expr ::= expr tlop value: the left is a full arithmetic
    // expression, while the RHS stops at one value. The low precedence lets
    // relational expressions consume the predicate on their right; precedence
    // and parentheses are pinned by the hand-written task trees.
    _div_by_expression: $ => prec.left(0, seq(
      field("left", $._arithmetic), field("operator", $.div_by_operator),
      token.immediate(/\s+/), field("right", $._unary),
    )),
    div_by_operator: _ => token(/is\s+div\s+by/),
    _parity_by_expression: $ => prec.left(0, seq(
      field("left", $._arithmetic), field("operator", $.parity_by_operator), field("right", $._unary),
    )),
    parity_by_operator: _ => token(/is[\t \r\n\v\f]+(?:not[\t \r\n\v\f]+)?(?:odd|even)[\t \r\n\v\f]+by/i),
    single_condition_expression: $ => prec.left(0, seq(
      field("left", $._arithmetic), field("operator", $.single_condition_operator),
    )),
    _unary: $ => choice($._modified, $.unary_expression),
    unary_expression: $ => choice($._not_expression, $._sign_expression, $._word_not_expression),
    _not_expression: $ => prec(3, seq(field("operator", "!"), field("argument", $._unary))),
    // Adjacent sign pairs belong to Smarty's INCDEC token, not nested unary
    // signs. A repeated prefix sign therefore needs an explicit whitespace gap.
    _sign_expression: $ => prec(3, seq(field("operator", choice("+", "-")), choice(
      field("argument", choice($._modified, alias($._not_expression, $.unary_expression))),
      seq(token.immediate(/\s+/), field("argument", $.unary_expression)),
    ))),
    _word_not_expression: $ => prec(3, seq(
      field("operator", alias(token(/[nN][oO][tT]/), $.word_operator)),
      token.immediate(/[\t \r\n\v\f]+/), field("argument", $._unary),
    )),
    _modified: $ => choice($._primary, $.modifier_expression, $.typecast_expression),
    // Smarty's TYPECAST lexer pattern consumes optional following whitespace,
    // but this tree's operator field deliberately spans only the parenthesized
    // spelling; global extras account for the gap before its operand. Keep the
    // operand at the existing unary/value boundary, so a prefix sign belongs
    // to the cast but adjacent modifier or arithmetic expressions remain out.
    typecast_expression: $ => prec(4, seq(
      field("operator", $.typecast_operator), field("argument", $._typecast_argument),
    )),
    _typecast_argument: $ => choice($._primary, $.unary_expression, $.typecast_expression),
    typecast_operator: _ => token(/\((?:int(?:eger)?|bool(?:ean)?|float|double|real|string|binary|array|object)\)/i),
    // Static Smarty IDs are primary values. Keep digit-prefixed ID tokens in
    // the same node family; pure decimals remain numbers and primitives keep
    // their dedicated token types.
    _primary: $ => choice($.section_property_expression, $._nonliteral_primary, $.boolean, $.null, $.identifier, alias($._modifier_identifier, $.identifier)),
    _nonliteral_primary: $ => choice(
      $.variable, $.loop_metadata_expression, $.config_variable, $.member_expression, $.method_call_expression, $.function_call_expression, $.index_expression, alias($._config_index, $.index_expression), $.array_literal,
      $.number, $.string, $.interpolated_string, $.parenthesized_expression, $.static_method_call_expression, $.class_constant_expression,
    ),
    // Smarty item metadata is an adjacent static suffix on a variable. Keep
    // the property as syntax rather than validating runtime loop bindings.
    loop_metadata_expression: $ => prec(9, seq(
      field("item", $.variable), token.immediate("@"),
      field("property", alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier)),
    )),
    array_literal: $ => choice(
      seq("[", optional(seq($.array_element, repeat(seq(",", $.array_element)), optional(","))), "]"),
      seq("array", "(", optional(seq($.array_element, repeat(seq(",", $.array_element)), optional(","))), ")"),
    ),
    array_element: $ => choice(
      seq(field("key", choice($._primary, $.unary_expression, $.typecast_expression)), "=>", field("value", $._expression)),
      field("value", $._expression),
    ),
    variable: $ => seq("$", field("name", alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier))),
    // Smarty requires both the name and closing hash to be adjacent.
    config_variable: $ => seq("#", field("name", alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier)), token.immediate("#")),
    // Separate config indices from object-capable receivers. A method result may
    // acquire a property/call, but cannot directly acquire an index in Smarty.
    index_expression: $ => prec.left(7, seq(
      field("object", choice($.variable, $.member_expression, $.index_expression)), $._index_suffix,
    )),
    _config_index: $ => prec.left(7, seq(
      field("object", choice($.config_variable, alias($._config_index, $.index_expression))), $._index_suffix,
    )),
    section_property_expression: $ => prec.dynamic(20, seq(
      token(/\$smarty\.section\./), field("section", $.identifier), ".", field("property", $.identifier),
    )),
    _index_suffix: $ => choice(
      seq(token.immediate(/\.\{/), field("index", $._expression), "}"),
      seq(token.immediate("."), field("index", choice(
        alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier),
        // Integer-only tokens prevent .1.2 from collapsing into a decimal key.
        alias(token.immediate(/[0-9]+/), $.number),
      ))),
      prec.dynamic(4, field("index", $.section_index)),
      prec.dynamic(4, field("index", $.section_property_index)),
      choice(
        prec.dynamic(50, seq($._bracket_braced_index_open, field("index", alias($._braced_index_output_expression, $.output)), "]")),
        seq("[", field("index", $._index_value), "]"),
      ),
    ),
    section_index: $ => seq("[", field("name", $.identifier), "]"),
    section_property_index: $ => seq("[", field("section", $.identifier), ".", field("property", $.identifier), "]"),
    // Bare [true]/[false]/[null] are Smarty section names. Only parentheses or
    // an actual compound expression make primitives expression-valued indices.
    _index_value: $ => choice(
      $._nonliteral_primary, $.unary_expression, $.typecast_expression, $.modifier_expression, $.binary_expression,
      alias($._xor_expression, $.binary_expression), alias($._or_expression, $.binary_expression),
      alias($._word_or_expression, $.binary_expression), alias($._and_expression, $.binary_expression),
      alias($._word_and_expression, $.binary_expression),
      alias($._equality_expression, $.binary_expression), alias($._relational_expression, $.binary_expression),
    ),
    // Restrict receivers to variables and static property/call/index chains.
    // Left recursion preserves each member, binding above modifiers (4) and arithmetic.
    // Control keywords are ordinary names after ->, while still reserved as tags.
    member_expression: $ => prec.left(5, seq(
      field("object", choice($.variable, $.member_expression, $.method_call_expression, $.index_expression)), "->", field("member", reserved("property", $.identifier)),
    )),
    // Prefer a call over a property plus a separate parenthesized tag argument.
    method_call_expression: $ => prec.left(6, seq(
      field("object", choice($.variable, $.member_expression, $.method_call_expression, $.index_expression)),
      "->", field("method", reserved("property", $.identifier)), "(",
      optional(seq(field("argument", $._expression), repeat(seq(",", field("argument", $._expression))))), ")",
    )),
    // A namespace-qualified static receiver keeps each source identifier and
    // separator in one named range. Only separators within the name are
    // immediate, so expression whitespace before the first segment remains
    // available; a rooted name is allowed with only one segment.
    _qualified_name_segment: $ => choice(
      // The class-reserved set normally excludes self/parent for a plain
      // receiver, but all namespace segments are Smarty IDs. Use the empty
      // property-reserved set locally and restore exact lowercase control-word
      // spellings that the global reserved set would otherwise intercept.
      reserved("property", $.identifier),
      alias(choice(...controlWords), $.identifier),
      // Smarty namespace segments also accept IDs with digits before the first
      // letter; keep that spelling local to qualified class names.
      alias($._modifier_identifier, $.identifier),
    ),
    _qualified_name_segment_immediate: _ => token.immediate(/[0-9]*[a-zA-Z_][a-zA-Z0-9_]*/),
    qualified_name: $ => choice(
      prec.dynamic(2, seq("\\", alias($._qualified_name_segment_immediate, $.identifier), repeat(seq(
        token.immediate("\\"), alias($._qualified_name_segment_immediate, $.identifier),
      )))),
      seq($._qualified_name_segment, token.immediate("\\"), alias($._qualified_name_segment_immediate, $.identifier),
        repeat(seq(token.immediate("\\"), alias($._qualified_name_segment_immediate, $.identifier)))),
    ),
    // Static calls are a distinct primary expression. Keep the class and method
    // identifiers separate from class constants and preserve each argument.
    // Match the class-name tokens accepted by static constants, including
    // control words and primitive literals while excluding self and parent.
    static_method_call_expression: $ => prec(9, seq(
      field("class", choice(
        $.qualified_name,
        reserved("class", $.identifier), alias(choice(...controlWords), $.identifier),
        alias($.boolean, $.identifier), alias($.null, $.identifier),
      )), token.immediate("::"),
      field("method", reserved("property", alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier))), "(",
      optional(seq(field("argument", $._expression), repeat(seq(",", field("argument", $._expression))))), ")",
    )),
    // Calls on a static unqualified identifier are expressions, including the
    // tag-shaped `{name(args)}` form which Smarty compiles as function output.
    function_call_expression: $ => prec.left(8, seq(
      field("name", choice($.identifier, $._not_identifier)), "(",
      optional(seq(field("argument", $._expression), repeat(seq(",", field("argument", $._expression))))), ")",
    )),
    identifier: _ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    _not_identifier: $ => alias(token(/[nN][oO][tT]/), $.identifier),
    _modifier_identifier: _ => token(/[0-9]+[a-zA-Z_][a-zA-Z0-9_]*/),
    // Control/primitive words are contextual class names, but self/parent are
    // explicitly rejected by Smarty. Both sides of :: require adjacency.
    class_constant_expression: $ => prec(8, seq(
      field("class", choice(
        reserved("class", $.identifier), alias(choice(...controlWords), $.identifier),
        alias($.boolean, $.identifier), alias($.null, $.identifier),
      )), token.immediate("::"),
      field("constant", alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier)),
    )),
    boolean: _ => choice(...cases("true"), ...cases("false")),
    null: _ => choice(...cases("null")),
    number: _ => /[0-9]+(?:\.[0-9]+)?/,
    // The double-quoted token excludes an unescaped `{*` so that the string
    // scanner can report Smarty's rejected comment opener. The paired-brace
    // branch preserves the old dollar and escape alternatives without regex
    // lookahead; in particular, `{$name}` must still select interpolation.
    string: _ => choice(
      /'[^'\\]*(?:\\.[^'\\]*)*'/,
      /"(?:[^"\\${]|\{(?:[^*"$\\]|\\.|\$[^A-Za-z0-9_$]|\$[0-9]+[^A-Za-z0-9_$]|\$\$*[^A-Za-z0-9_$]|\$\$*[0-9]+[^A-Za-z0-9_$]|\$[0-9]+\$\$*[^A-Za-z0-9_$])|\\.|\$[^A-Za-z0-9_$]|\$[0-9]+[^A-Za-z0-9_$]|\$\$*[^A-Za-z0-9_$]|\$\$*[0-9]+[^A-Za-z0-9_$]|\$[0-9]+\$\$*[^A-Za-z0-9_$])*(?:\$[0-9]*)?(?:\$\$*)?\{?"/,
    ),
    // Smarty switches lexer modes inside double quotes. External tokens keep
    // literal fragments distinct from actual variable/tag interpolation, and
    // preserve the existing string node when a quote contains no interpolation.
    interpolated_string: $ => seq(
      '"', repeat($.string_fragment), $.string_interpolation,
      repeat(choice($.string_fragment, $.string_interpolation)), '"',
    ),
    string_interpolation: $ => choice(
      field("value", choice($.variable, alias($._interpolated_digit_id, $.variable))),
      seq("{", field("value", $._expression), "}"),
      seq($._quoted_comment_start, $._output_attribute_error_marker),
      // Smarty's double-quoted lexer re-enters ordinary tag parsing for a
      // template tag. Keep the supported block and generic-tag structure under
      // the string interpolation boundary instead of flattening it to text.
      field("value", $.if_block),
      field("value", choice($.custom_tag, $.custom_close_tag, $.assignment_tag)),
      seq($._backtick_interpolation_start, field("value", $._expression), token.immediate("`")),
    ),
    // Smarty's double-quoted lexer accepts digit-prefixed IDs. Keep that
    // boundary local to interpolation instead of broadening variables in tags.
    _interpolated_digit_id: $ => seq(
      "$", field("name", alias(token.immediate(/[0-9]+[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier)),
    ),
    parenthesized_expression: $ => seq("(", $._expression, ")"),
    binary_expression: $ => choice(
      .../** @type {[number, string[]][]} */ ([[1, ["+", "-"]], [2, ["*", "/", "%"]]]).map(([precedence, operators]) =>
        prec.left(precedence, seq(field("left", $._arithmetic), field("operator", choice(...operators)), field("right", $._arithmetic)))),
    ),
    modifier_expression: $ => prec.left(4, seq(
      field("value", $._modified), choice(token(prec(2, /\|@{1,2}/)), "|"), field("name", $.identifier),
      repeat(seq(":", field("argument", $._modifier_argument))),
    )),
    _modifier_argument: $ => choice(
      prec.dynamic(10, alias($._braced_modifier_argument, $.output)),
      $.typecast_expression, $.section_property_expression, $.variable, $.loop_metadata_expression, $.config_variable,
      $.member_expression, $.method_call_expression, $.function_call_expression, $.static_method_call_expression,
      $.index_expression, alias($._config_index, $.index_expression), $.array_literal, $.number, $.string,
      $.interpolated_string, $.parenthesized_expression, $.boolean, $.null, $.class_constant_expression,
      $.identifier, alias($._modifier_identifier, $.identifier),
    ),
    // A braced modifier argument is one complete expression wrapped in the
    // same output node used for other expression wrappers. Keep it local to
    // argument position so braces do not become general modifier primaries.
    _braced_modifier_argument: $ => seq("{", field("value", $._expression), "}"),
  }
});
