/**
 * @file Initial Smarty 5 subset for tree-sitter (package name: smarty2)
 * @author roguecat0 <roguecat0@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Explicit keyword spellings cooperate with Tree-sitter's word token: a longer
// identifier such as TRUEish must win, and contextual names remain identifiers.
const cases = word => [...word].reduce((forms, ch) => forms.flatMap(form => [form + ch, form + ch.toUpperCase()]), [""]);
const primitiveWords = [...cases("true"), ...cases("false"), ...cases("null")];
const controlWords = ["if", "else", "elseif", "foreach", "foreachelse"];
const classReservedWords = [...cases("self"), ...cases("parent")];

export default grammar({
  name: "smarty2",
  externals: $ => [$._output_attribute_error_marker],
  extras: _ => [/\s/],
  word: $ => $.identifier,
  reserved: {
    global: _ => controlWords,
    tag: _ => [...controlWords, ...primitiveWords],
    property: _ => [],
    class: _ => classReservedWords,
  },
  conflicts: $ => [[$.elseif_clause], [$.else_clause], [$.foreachelse_clause]],
  rules: {
    source_file: $ => repeat($._node),
    _node: $ => choice($.text, $.output, $.custom_tag, $.custom_close_tag, $.if_block, $.comment, $.foreach_block),
    text: _ => /[^{}]+/,
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
    _tag_name: $ => choice(reserved("tag", $.identifier), alias(choice(...classReservedWords), $.identifier)),
    custom_tag: $ => seq("{", field("name", $._tag_name), repeat(choice(
      $.attribute, field("argument", $._expression),
    )), "}"),
    custom_close_tag: $ => seq("{/", field("name", $.identifier), "}"),
    // Primitive tokens also occur where a tag accepts a named attribute.
    _attribute_name: $ => choice($.identifier, alias($.boolean, $.identifier), alias($.null, $.identifier)),
    attribute: $ => seq(field("name", $._attribute_name), "=", field("value", $._expression)),
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
    foreach_tag: $ => seq(
      "{", "foreach", token.immediate(/\s+/), field("source", $._expression),
      // Smarty requires whitespace around contextual `as`; generic tag names
      // and keyword-named properties keep their ordinary identifier behavior.
      alias(token.immediate(/\s+as\s+/), "as"),
      optional(seq(field("key", $.variable), "=>")), field("item", $.variable), "}",
    ),
    foreachelse_clause: $ => seq($.foreachelse_tag, repeat($._node)),
    foreachelse_tag: _ => seq("{", "foreachelse", "}"),
    foreach_close_tag: _ => seq("{/", "foreach", "}"),
    _expression: $ => $._logical_or,
    // Layer comparison operands so an unparenthesized second comparison cannot
    // silently acquire associativity. Aliases preserve the public binary tree.
    _logical_or: $ => choice($._logical_and, alias($._or_expression, $.binary_expression)),
    _or_expression: $ => prec.left(-4, seq(field("left", $._logical_or), field("operator", "||"), field("right", $._logical_and))),
    _logical_and: $ => choice($._equality, alias($._and_expression, $.binary_expression)),
    _and_expression: $ => prec.left(-3, seq(field("left", $._logical_and), field("operator", "&&"), field("right", $._equality))),
    _equality: $ => choice($._relational, alias($._equality_expression, $.binary_expression)),
    _equality_expression: $ => prec(-2, seq(field("left", $._relational), field("operator", choice("==", "!=", "===", "!==")), field("right", $._relational))),
    _relational: $ => choice($._arithmetic, alias($._relational_expression, $.binary_expression)),
    _relational_expression: $ => prec(-1, seq(field("left", $._arithmetic), field("operator", choice("<", "<=", ">", ">=")), field("right", $._arithmetic))),
    _arithmetic: $ => choice($._unary, $.binary_expression),
    _unary: $ => choice($._modified, $.unary_expression),
    unary_expression: $ => choice($._not_expression, $._sign_expression),
    _not_expression: $ => prec(3, seq(field("operator", "!"), field("argument", $._unary))),
    // Adjacent sign pairs belong to Smarty's INCDEC token, not nested unary
    // signs. A repeated prefix sign therefore needs an explicit whitespace gap.
    _sign_expression: $ => prec(3, seq(field("operator", choice("+", "-")), choice(
      field("argument", choice($._modified, alias($._not_expression, $.unary_expression))),
      seq(token.immediate(/\s+/), field("argument", $.unary_expression)),
    ))),
    _modified: $ => choice($._primary, $.modifier_expression),
    _primary: $ => choice($._nonliteral_primary, $.boolean, $.null),
    _nonliteral_primary: $ => choice(
      $.variable, $.loop_metadata_expression, $.config_variable, $.member_expression, $.method_call_expression, $.function_call_expression, $.index_expression, alias($._config_index, $.index_expression), $.array_literal,
      $.number, $.string, $.parenthesized_expression, $.class_constant_expression,
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
      seq(field("key", choice($._primary, $.identifier)), "=>", field("value", $._expression)),
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
    _index_suffix: $ => choice(
      seq(token.immediate("."), field("index", choice(
        alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier),
        // Integer-only tokens prevent .1.2 from collapsing into a decimal key.
        alias(token.immediate(/[0-9]+/), $.number),
      ))),
      seq("[", field("index", $._index_value), "]"),
    ),
    // Bare [true]/[false]/[null] are Smarty section names. Only parentheses or
    // an actual compound expression make primitives expression-valued indices.
    _index_value: $ => choice(
      $._nonliteral_primary, $.unary_expression, $.modifier_expression, $.binary_expression,
      alias($._or_expression, $.binary_expression), alias($._and_expression, $.binary_expression),
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
    // Calls on a static unqualified identifier are expressions, including the
    // tag-shaped `{name(args)}` form which Smarty compiles as function output.
    function_call_expression: $ => prec.left(8, seq(
      field("name", $.identifier), "(",
      optional(seq(field("argument", $._expression), repeat(seq(",", field("argument", $._expression))))), ")",
    )),
    identifier: _ => /[a-zA-Z_][a-zA-Z0-9_]*/,
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
    string: _ => choice(/'[^'\\]*(?:\\.[^'\\]*)*'/, /"[^"\\$]*(?:\\.[^"\\$]*)*"/),
    parenthesized_expression: $ => seq("(", $._expression, ")"),
    binary_expression: $ => choice(
      ...[[1, ["+", "-"]], [2, ["*", "/", "%"]]].map(([precedence, operators]) =>
        prec.left(precedence, seq(field("left", $._arithmetic), field("operator", choice(...operators)), field("right", $._arithmetic)))),
    ),
    modifier_expression: $ => prec.left(4, seq(
      field("value", $._modified), "|", field("name", $.identifier),
      repeat(seq(":", field("argument", $._modifier_argument))),
    )),
    _modifier_argument: $ => choice($.variable, $.config_variable, $.member_expression, $.method_call_expression, $.function_call_expression, $.index_expression, alias($._config_index, $.index_expression), $.array_literal, $.number, $.string, $.parenthesized_expression, $.boolean, $.null, $.class_constant_expression),
  }
});
