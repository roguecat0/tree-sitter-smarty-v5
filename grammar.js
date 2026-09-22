/**
 * @file Initial Smarty 5 subset for tree-sitter (package name: smarty2)
 * @author roguecat0 <roguecat0@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "smarty2",
  extras: _ => [/\s/],
  word: $ => $.identifier,
  reserved: { global: _ => ["if", "else", "elseif"], property: _ => [] },
  conflicts: $ => [[$.elseif_clause], [$.else_clause]],
  rules: {
    source_file: $ => repeat($._node),
    _node: $ => choice($.text, $.output, $.custom_tag, $.custom_close_tag, $.if_block, $.comment),
    text: _ => /[^{}]+/,
    // A single token hides all template syntax and stops at the first *}.
    // Star runs cannot consume a closing brace; the following newline is text.
    comment: _ => token(seq("{*", /([^*]|\*+[^*}])*/, /\*+/, "}")),
    output: $ => seq("{", field("value", $._expression), "}"),
    custom_tag: $ => seq("{", field("name", $.identifier), repeat(choice(
      $.attribute, field("argument", $._expression),
    )), "}"),
    custom_close_tag: $ => seq("{/", field("name", $.identifier), "}"),
    attribute: $ => seq(field("name", $.identifier), "=", field("value", $._expression)),
    if_block: $ => seq(
      $.if_tag, repeat($._node), repeat($.elseif_clause), optional($.else_clause), $.if_close_tag,
    ),
    if_tag: $ => seq("{", "if", field("condition", $._expression), "}"),
    elseif_clause: $ => seq($.elseif_tag, repeat($._node)),
    elseif_tag: $ => seq("{", "elseif", field("condition", $._expression), "}"),
    else_clause: $ => seq($.else_tag, repeat($._node)),
    else_tag: _ => seq("{", "else", "}"),
    if_close_tag: _ => seq("{/", "if", "}"),
    _expression: $ => choice(
      $.variable, $.config_variable, $.member_expression, $.number, $.string, $.parenthesized_expression,
      $.binary_expression, $.modifier_expression,
    ),
    variable: $ => seq("$", field("name", alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier))),
    // Smarty requires both the name and closing hash to be adjacent.
    config_variable: $ => seq("#", field("name", alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier)), token.immediate("#")),
    // Restrict receivers to variables/chains; calls and dynamic members are separate tasks.
    // Left recursion preserves each member, binding above modifiers (3) and arithmetic.
    // Control keywords are ordinary names after ->, while still reserved as tags.
    member_expression: $ => prec.left(4, seq(
      field("object", choice($.variable, $.member_expression)), "->", field("member", reserved("property", $.identifier)),
    )),
    identifier: _ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    number: _ => /[0-9]+(?:\.[0-9]+)?/,
    string: _ => choice(/'[^'\\]*(?:\\.[^'\\]*)*'/, /"[^"\\$]*(?:\\.[^"\\$]*)*"/),
    parenthesized_expression: $ => seq("(", $._expression, ")"),
    binary_expression: $ => choice(
      ...[[1, ["+", "-"]], [2, ["*", "/", "%"]]].map(([precedence, operators]) =>
        prec.left(precedence, seq(field("left", $._expression), field("operator", choice(...operators)), field("right", $._expression)))),
    ),
    modifier_expression: $ => prec.left(3, seq(
      field("value", $._expression), "|", field("name", $.identifier),
      repeat(seq(":", field("argument", $._modifier_argument))),
    )),
    _modifier_argument: $ => choice($.variable, $.config_variable, $.member_expression, $.number, $.string, $.parenthesized_expression),
  }
});
