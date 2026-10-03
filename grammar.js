/**
 * @file Initial Smarty 5 subset for tree-sitter (package name: smarty2)
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
  name: "smarty2",
  externals: $ => [
    $.text, $._output_attribute_error_marker,
    $.string_fragment, $._backtick_interpolation_start,
    $._literal_opener, $.literal_content, $.literal_close_tag,
    $._word_and_operator, $._word_or_operator, $._word_xor_operator,
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
    _node: $ => choice($.text, $.output, $.custom_tag, $.custom_close_tag, $.if_block, $.comment, $.foreach_block, $.for_block, $.section_block, $.literal_block, $.stray_literal_close),
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
    output: $ => choice(
      // A no-source external marker forces a parse error after this explicit
      // recovery node without making any input spelling valid.
      prec(9, seq("{", field("value", $.function_call_expression), alias(repeat1($.attribute), "ERROR"), $._output_attribute_error_marker, "}")),
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
    attribute: $ => seq(field("name", $._attribute_name), "=", field("value", $._tag_attribute_value)),
    tag_attribute_name: _ => token(choice(
      /[0-9]+[a-zA-Z_][a-zA-Z0-9_-]*(?::[a-zA-Z0-9_-]+)*/,
      /[a-zA-Z_][a-zA-Z0-9_-]*-[a-zA-Z0-9_-]*(?::[a-zA-Z0-9_-]+)*/,
      /[a-zA-Z_][a-zA-Z0-9_-]*:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*/,
    )),
    // Smarty's tag value productions accept a direct ID in these two tag-only
    // positions. Keep it out of _expression so a bare name does not become a
    // general value in outputs, conditions, or other expression contexts.
    _tag_argument_value: $ => choice(prec(1, $._expression), prec(-1, $.identifier), prec(-1, $._not_identifier), prec(-1, alias($._modifier_identifier, $.identifier))),
    _tag_attribute_value: $ => choice(prec(1, $._expression), prec(-1, $.identifier), prec(-1, $._not_identifier), prec(-1, alias($._modifier_identifier, $.identifier))),
    if_block: $ => seq(
      $.if_tag, repeat($._node), repeat($.elseif_clause), optional($.else_clause), $.if_close_tag,
    ),
    if_tag: $ => seq("{", "if", field("condition", $._expression), "}"),
    elseif_clause: $ => seq($.elseif_tag, repeat($._node)),
    elseif_tag: $ => seq("{", "elseif", field("condition", $._expression), "}"),
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
        repeat(choice($.attribute, alias($.foreach_nocache_attribute, $.attribute), $.foreach_option)), "}",
      )),
      // Tree-sitter cannot create a named node from an empty repeat; an empty
      // legacy list is therefore represented by the absence of a header node.
      seq("{", "foreach", optional(token.immediate(/\s+/)), "}"),
      seq("{", "foreach", alias(repeat1(seq(
        token.immediate(/\s+/),
        choice($.attribute, alias($.foreach_nocache_attribute, $.attribute), $.foreach_option, field("argument", $._legacy_foreach_argument)),
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
        $.attribute,
        $.for_option,
        field("argument", $._for_bare_argument),
      )),
      optional(field("argument", alias("step", $.identifier))),
    ),
    c_style_for_header: $ => choice(
      seq(
        field("initializer", $.for_initializer), repeat(seq(",", field("initializer", $.for_initializer))),
        ";", field("condition", $._expression), ";", field("update", $.for_update),
        repeat(choice($.attribute, $.for_option, field("argument", $._for_bare_argument))),
        optional(field("argument", alias("step", $.identifier))),
      ),
      // Keep the loop boundary navigable when the C-style condition is omitted.
      // The impossible marker forces a real parse error after consuming the
      // malformed header, allowing for_block to retain its body and closer.
      prec(-1, seq(
        field("initializer", $.for_initializer), repeat(seq(",", field("initializer", $.for_initializer))),
        ";", ";", field("update", $.for_update),
        repeat(choice($.attribute, $.for_option, field("argument", $._for_bare_argument))),
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
    _section_option: $ => choice($.attribute, $.section_option),
    section_option: _ => "nocache",
    sectionelse_clause: $ => seq($.sectionelse_tag, repeat($._node)),
    sectionelse_tag: _ => seq("{", "sectionelse", "}"),
    section_close_tag: _ => seq("{/", "section", "}"),
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
    _equality: $ => choice($._relational, alias($._equality_expression, $.binary_expression)),
    _equality_expression: $ => prec(-2, seq(field("left", $._relational), field("operator", choice("==", "!=", "===", "!==")), field("right", $._relational))),
    _relational: $ => choice($._arithmetic, alias($._relational_expression, $.binary_expression)),
    _relational_expression: $ => prec(-1, seq(field("left", $._arithmetic), field("operator", choice("<", "<=", ">", ">=")), field("right", $._arithmetic))),
    _arithmetic: $ => choice($._unary, $.binary_expression, alias($._div_by_expression, $.binary_expression)),
    // Match Smarty's expr ::= expr tlop value: the left is a full arithmetic
    // expression, while the RHS stops at one value. The low precedence lets
    // relational expressions consume the predicate on their right; precedence
    // and parentheses are pinned by the hand-written task trees.
    _div_by_expression: $ => prec.left(0, seq(
      field("left", $._arithmetic), field("operator", $.div_by_operator),
      token.immediate(/\s+/), field("right", $._unary),
    )),
    div_by_operator: _ => token(/is\s+div\s+by/),
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
    _modified: $ => choice($._primary, $.modifier_expression),
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
      seq(field("key", $._primary), "=>", field("value", $._expression)),
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
      seq(token.immediate("."), field("index", choice(
        alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier),
        // Integer-only tokens prevent .1.2 from collapsing into a decimal key.
        alias(token.immediate(/[0-9]+/), $.number),
      ))),
      prec.dynamic(4, field("index", $.section_index)),
      prec.dynamic(4, field("index", $.section_property_index)),
      seq("[", field("index", $._index_value), "]"),
    ),
    section_index: $ => seq("[", field("name", $.identifier), "]"),
    section_property_index: $ => seq("[", field("section", $.identifier), ".", field("property", $.identifier), "]"),
    // Bare [true]/[false]/[null] are Smarty section names. Only parentheses or
    // an actual compound expression make primitives expression-valued indices.
    _index_value: $ => choice(
      $._nonliteral_primary, $.unary_expression, $.modifier_expression, $.binary_expression,
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
    // Static calls are a distinct primary expression. Keep the class and method
    // identifiers separate from class constants and preserve each argument.
    // Match the class-name tokens accepted by static constants, including
    // control words and primitive literals while excluding self and parent.
    static_method_call_expression: $ => prec(9, seq(
      field("class", choice(
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
    string: _ => choice(
      /'[^'\\]*(?:\\.[^'\\]*)*'/,
      /"(?:[^"\\$]|\\.|\$[^A-Za-z0-9_$]|\$[0-9]+[^A-Za-z0-9_$]|\$\$*[^A-Za-z0-9_$]|\$\$*[0-9]+[^A-Za-z0-9_$]|\$[0-9]+\$\$*[^A-Za-z0-9_$])*(?:\$[0-9]*)?(?:\$\$*)?"/,
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
      field("value", $._modified), "|", field("name", $.identifier),
      repeat(seq(":", field("argument", $._modifier_argument))),
    )),
    _modifier_argument: $ => choice($.section_property_expression, $.variable, $.loop_metadata_expression, $.config_variable, $.member_expression, $.method_call_expression, $.function_call_expression, $.static_method_call_expression, $.index_expression, alias($._config_index, $.index_expression), $.array_literal, $.number, $.string, $.interpolated_string, $.parenthesized_expression, $.boolean, $.null, $.class_constant_expression, $.identifier, alias($._modifier_identifier, $.identifier)),
  }
});
