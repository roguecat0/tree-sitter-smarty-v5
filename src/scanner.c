#include "tree_sitter/parser.h"
#include <stdlib.h>

enum TokenType {
  TEXT,
  OUTPUT_ATTRIBUTE_ERROR_MARKER,
  TAG_ATTRIBUTE_OUTPUT_SPACE,
  TAG_ATTRIBUTE_OUTPUT_START,
  IF_HEADER_CLOSE_RECOVERY,
  OUTPUT_NOCACHE_NAME,
  STRING_FRAGMENT,
  BACKTICK_INTERPOLATION_START,
  LITERAL_OPENER,
  LITERAL_CONTENT,
  LITERAL_CLOSE_TAG,
  WORD_AND_OPERATOR,
  WORD_OR_OPERATOR,
  WORD_XOR_OPERATOR,
  WORD_EQUALITY_OPERATOR,
  WORD_RELATIONAL_OPERATOR,
  BRACKET_BRACED_INDEX_OPEN,
  SINGLE_CONDITION_OPERATOR,
};

typedef struct {
  bool in_literal;
  bool expect_literal_close;
} ScannerState;

static int32_t ascii_lower(int32_t c);
static bool is_smarty_whitespace(int32_t c);

static bool is_ascii_digit(int32_t c) {
  return c >= '0' && c <= '9';
}

static bool is_ascii_identifier_start(int32_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_';
}

static bool scan_nocache_or_neq_after_gap(TSLexer *lexer, const bool *valid_symbols) {
  if (ascii_lower(lexer->lookahead) != 'n') return false;
  lexer->advance(lexer, false);
  if (ascii_lower(lexer->lookahead) == 'e' && valid_symbols[WORD_EQUALITY_OPERATOR]) {
    lexer->advance(lexer, false);
    if (ascii_lower(lexer->lookahead) == 'q') lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    if (!is_smarty_whitespace(lexer->lookahead)) return false;
    lexer->result_symbol = WORD_EQUALITY_OPERATOR;
    return true;
  }
  if (ascii_lower(lexer->lookahead) != 'o' || !valid_symbols[OUTPUT_NOCACHE_NAME]) return false;
  static const char rest[] = "ocache";
  for (size_t i = 0; i < sizeof(rest) - 1; i++) {
    if (ascii_lower(lexer->lookahead) != rest[i]) return false;
    lexer->advance(lexer, false);
  }
  if (is_ascii_identifier_start(lexer->lookahead) || is_ascii_digit(lexer->lookahead) || lexer->lookahead == '-') return false;
  lexer->mark_end(lexer);
  lexer->result_symbol = OUTPUT_NOCACHE_NAME;
  return true;
}

static int32_t ascii_lower(int32_t c) {
  return c >= 'A' && c <= 'Z' ? c + ('a' - 'A') : c;
}

static bool is_smarty_whitespace(int32_t c) {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\v' || c == '\f';
}

// In a generic-tag named attribute, an expression wrapper must not allow the
// auto-literal `{ ` form. Only the opening brace is consumed, keeping its exact
// source range and leaving the expression to normal grammar rules.
static bool scan_tag_attribute_output_start(TSLexer *lexer) {
  if (lexer->lookahead != '{') return false;
  lexer->advance(lexer, false);
  // A comment opener after a missing attribute value belongs to the following
  // sibling, not to the attempted output wrapper.
  if (is_smarty_whitespace(lexer->lookahead) || lexer->lookahead == '*') return false;
  lexer->mark_end(lexer);
  lexer->result_symbol = TAG_ATTRIBUTE_OUTPUT_START;
  return true;
}

static bool scan_if_header_close_recovery(TSLexer *lexer) {
  static const char spelling[] = "{/if}";
  for (size_t i = 0; i < sizeof(spelling) - 1; i++) {
    if (lexer->lookahead != spelling[i]) return false;
    lexer->advance(lexer, false);
  }
  lexer->mark_end(lexer);
  lexer->result_symbol = IF_HEADER_CLOSE_RECOVERY;
  return true;
}

// Select a separate bracket-index production only when a Smarty braced
// expression follows the opening bracket. The token ends at `[`: outer
// whitespace stays a skipped extra, while the lookahead rejects `{ $expr}`.
static bool scan_bracket_braced_index_open(TSLexer *lexer) {
  if (lexer->lookahead != '[') return false;
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  while (is_smarty_whitespace(lexer->lookahead)) lexer->advance(lexer, false);
  if (lexer->lookahead != '{') return false;
  lexer->advance(lexer, false);
  if (is_smarty_whitespace(lexer->lookahead) || lexer->lookahead == '*') return false;
  lexer->result_symbol = BRACKET_BRACED_INDEX_OPEN;
  return true;
}

static bool scan_tag_attribute_output_space(TSLexer *lexer) {
  if (!is_smarty_whitespace(lexer->lookahead)) return false;
  do {
    lexer->advance(lexer, false);
  } while (is_smarty_whitespace(lexer->lookahead));
  lexer->mark_end(lexer);
  if (lexer->lookahead != '{') return false;
  lexer->advance(lexer, false);
  if (is_smarty_whitespace(lexer->lookahead)) return false;
  lexer->result_symbol = TAG_ATTRIBUTE_OUTPUT_SPACE;
  return true;
}

// Smarty emits a SLOGOP only when one of these words has whitespace on both
// sides. Skip the leading gap so the public token range contains only letters,
// then mark the exact operator end and verify the trailing boundary.
static bool scan_word_operator(TSLexer *lexer, const bool *valid_symbols) {
  const char *word = NULL;
  enum TokenType symbol;
  switch (ascii_lower(lexer->lookahead)) {
    case 'a':
      if (valid_symbols[WORD_AND_OPERATOR]) {
        word = "and";
        symbol = WORD_AND_OPERATOR;
      }
      break;
    case 'o':
      if (valid_symbols[WORD_OR_OPERATOR]) {
        word = "or";
        symbol = WORD_OR_OPERATOR;
      }
      break;
    case 'x':
      if (valid_symbols[WORD_XOR_OPERATOR]) {
        word = "xor";
        symbol = WORD_XOR_OPERATOR;
      }
      break;
  }
  if (word == NULL) return false;

  for (const char *p = word; *p; p++) {
    if (ascii_lower(lexer->lookahead) != *p) return false;
    lexer->advance(lexer, false);
  }
  lexer->mark_end(lexer);
  if (!is_smarty_whitespace(lexer->lookahead)) return false;
  lexer->result_symbol = symbol;
  return true;
}

// Word comparisons share Smarty's two-sided SLOGOP whitespace boundary with
// the boolean words, but equality and relational words remain distinct tokens
// so grammar precedence matches their symbolic equivalents. mark_end preserves
// the public operator range as letters only.
static bool scan_word_comparison_operator(TSLexer *lexer, const bool *valid_symbols) {
  const int32_t first = ascii_lower(lexer->lookahead);
  const char *word = NULL;
  enum TokenType symbol;
  if ((first == 'e' || first == 'n') && valid_symbols[WORD_EQUALITY_OPERATOR]) {
    symbol = WORD_EQUALITY_OPERATOR;
    if (first == 'e') {
      word = "eq";
    } else {
      lexer->advance(lexer, false);
      if (ascii_lower(lexer->lookahead) != 'e') return false;
      lexer->advance(lexer, false);
      if (ascii_lower(lexer->lookahead) == 'q') {
        lexer->advance(lexer, false);
        word = "neq";
      } else {
        word = "ne";
      }
      lexer->mark_end(lexer);
      if (!is_smarty_whitespace(lexer->lookahead)) return false;
      lexer->result_symbol = symbol;
      return true;
    }
  } else if ((first == 'g' || first == 'l') && valid_symbols[WORD_RELATIONAL_OPERATOR]) {
    symbol = WORD_RELATIONAL_OPERATOR;
    lexer->advance(lexer, false);
    int32_t second = ascii_lower(lexer->lookahead);
    if (second == 't' && (first == 'g' || first == 'l')) {
      lexer->advance(lexer, false);
      if (ascii_lower(lexer->lookahead) == 'e') lexer->advance(lexer, false);
      lexer->mark_end(lexer);
      if (!is_smarty_whitespace(lexer->lookahead)) return false;
      lexer->result_symbol = symbol;
      return true;
    } else if (second == 'e' && first == 'g') {
      lexer->advance(lexer, false);
      if (ascii_lower(lexer->lookahead) == 't') {
        lexer->advance(lexer, false);
        word = "gte";
      } else {
        word = "ge";
      }
      lexer->mark_end(lexer);
      if (!is_smarty_whitespace(lexer->lookahead)) return false;
      lexer->result_symbol = symbol;
      return true;
    } else if (second == 'e' && first == 'l') {
      lexer->advance(lexer, false);
      if (ascii_lower(lexer->lookahead) == 't') {
        lexer->advance(lexer, false);
        word = "lte";
      } else {
        word = "le";
      }
      lexer->mark_end(lexer);
      if (!is_smarty_whitespace(lexer->lookahead)) return false;
      lexer->result_symbol = symbol;
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }

  for (const char *p = word; *p; p++) {
    if (ascii_lower(lexer->lookahead) != *p) return false;
    lexer->advance(lexer, false);
  }
  lexer->mark_end(lexer);
  if (!is_smarty_whitespace(lexer->lookahead)) return false;
  lexer->result_symbol = symbol;
  return true;
}

static bool scan_single_condition_operator(TSLexer *lexer);

static bool scan_gap_operator(TSLexer *lexer, const bool *valid_symbols) {
  if (!is_smarty_whitespace(lexer->lookahead)) return false;
  while (is_smarty_whitespace(lexer->lookahead)) lexer->advance(lexer, true);
  int32_t first = ascii_lower(lexer->lookahead);
  if (first == 'n') {
    if (scan_nocache_or_neq_after_gap(lexer, valid_symbols)) return true;
  }
  if (first == 'i' && valid_symbols[SINGLE_CONDITION_OPERATOR])
    return scan_single_condition_operator(lexer);
  if ((first == 'e' || first == 'n' || first == 'g' || first == 'l') &&
      (valid_symbols[WORD_EQUALITY_OPERATOR] || valid_symbols[WORD_RELATIONAL_OPERATOR]))
    return scan_word_comparison_operator(lexer, valid_symbols);
  if (first == 'a' || first == 'o' || first == 'x')
    return scan_word_operator(lexer, valid_symbols);
  return false;
}

// Skip SINGLECOND's leading whitespace so the public operator range starts at
// `is`. The gap dispatcher calls this only when `is` is the next word and
// defers to the longer grouping predicate when `by` follows.
static bool consume_single_condition_phrase(TSLexer *lexer, bool mark_operator_end) {
  if (ascii_lower(lexer->lookahead) != 'i') return false;
  lexer->advance(lexer, false);
  if (ascii_lower(lexer->lookahead) != 's') return false;
  lexer->advance(lexer, false);
  if (!is_smarty_whitespace(lexer->lookahead)) return false;
  while (is_smarty_whitespace(lexer->lookahead)) lexer->advance(lexer, false);

  if (ascii_lower(lexer->lookahead) == 'n') {
    lexer->advance(lexer, false);
    if (ascii_lower(lexer->lookahead) != 'o') return false;
    lexer->advance(lexer, false);
    if (ascii_lower(lexer->lookahead) != 't') return false;
    lexer->advance(lexer, false);
    if (!is_smarty_whitespace(lexer->lookahead)) return false;
    while (is_smarty_whitespace(lexer->lookahead)) lexer->advance(lexer, false);
  }

  const int32_t first = ascii_lower(lexer->lookahead);
  if (first != 'o' && first != 'e') return false;
  lexer->advance(lexer, false);
  if (first == 'o') {
    if (ascii_lower(lexer->lookahead) != 'd') return false;
    lexer->advance(lexer, false);
    if (ascii_lower(lexer->lookahead) != 'd') return false;
    lexer->advance(lexer, false);
  } else {
    if (ascii_lower(lexer->lookahead) != 'v') return false;
    lexer->advance(lexer, false);
    if (ascii_lower(lexer->lookahead) != 'e') return false;
    lexer->advance(lexer, false);
    if (ascii_lower(lexer->lookahead) != 'n') return false;
    lexer->advance(lexer, false);
  }
  if (mark_operator_end) lexer->mark_end(lexer);

  // `scond` has no word-end assertion in the pinned lexer, so `oddness`
  // still emits this prefix and then fails on the unconsumed `ness`. Only
  // distinguish the overlapping complete `is ... odd/even by` production.
  if (is_smarty_whitespace(lexer->lookahead)) {
    while (is_smarty_whitespace(lexer->lookahead)) lexer->advance(lexer, false);
    if (ascii_lower(lexer->lookahead) == 'b') {
      lexer->advance(lexer, false);
      if (ascii_lower(lexer->lookahead) == 'y') return false;
    }
  }
  return true;
}

static bool scan_single_condition_operator(TSLexer *lexer) {
  if (!consume_single_condition_phrase(lexer, true)) return false;
  lexer->result_symbol = SINGLE_CONDITION_OPERATOR;
  return true;
}

// Called after the opening `{` (and optional `/`) has been consumed. A
// mismatch leaves the consumed prefix available as literal content.
static bool consume_literal_marker_tail(TSLexer *lexer) {
  const char *marker = "literal}";
  for (const char *p = marker; *p; p++) {
    if (ascii_lower(lexer->lookahead) != *p) return false;
    lexer->advance(lexer, false);
  }
  return true;
}

static bool scan_literal_content(TSLexer *lexer, ScannerState *state) {
  bool has_content = false;
  unsigned nested = 0;

  while (!lexer->eof(lexer)) {
    if (lexer->lookahead == '{') {
      lexer->advance(lexer, false);
      if (ascii_lower(lexer->lookahead) == 'l') {
        if (consume_literal_marker_tail(lexer)) {
          nested++;
          has_content = true;
          lexer->mark_end(lexer);
          continue;
        }
      } else if (lexer->lookahead == '/') {
        lexer->advance(lexer, false);
        if (consume_literal_marker_tail(lexer)) {
          if (nested == 0) {
            state->in_literal = false;
            if (!has_content) {
              // Empty bodies still need the external closer token, but must
              // not create a zero-width literal_content node.
              lexer->mark_end(lexer);
              state->expect_literal_close = false;
              lexer->result_symbol = LITERAL_CLOSE_TAG;
              return true;
            }
            state->expect_literal_close = true;
            lexer->result_symbol = LITERAL_CONTENT;
            return true;
          }
          nested--;
          has_content = true;
          lexer->mark_end(lexer);
          continue;
        }
      }
      // If this was a false lookalike, any consumed prefix belongs to content.
      // The mismatching character itself remains current for the next pass.
      lexer->mark_end(lexer);
      has_content = true;
      continue;
    }

    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    has_content = true;
  }

  if (has_content) {
    lexer->result_symbol = LITERAL_CONTENT;
    return true;
  }
  return false;
}

static bool scan_literal_opener(TSLexer *lexer, ScannerState *state) {
  for (const char *p = "literal"; *p; p++) {
    if (ascii_lower(lexer->lookahead) != *p) return false;
    lexer->advance(lexer, false);
  }
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
         lexer->lookahead == '\n' || lexer->lookahead == '\v' ||
         lexer->lookahead == '\f' || lexer->lookahead == '\r') {
    lexer->advance(lexer, false);
  }
  if (lexer->lookahead != '}') return false;
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  state->in_literal = true;
  state->expect_literal_close = false;
  lexer->result_symbol = LITERAL_OPENER;
  return true;
}

static bool scan_literal_close(TSLexer *lexer, ScannerState *state) {
  if (lexer->lookahead != '{') return false;
  lexer->advance(lexer, false);
  if (lexer->lookahead != '/') return false;
  lexer->advance(lexer, false);
  for (const char *p = "literal"; *p; p++) {
    if (ascii_lower(lexer->lookahead) != *p) return false;
    lexer->advance(lexer, false);
  }
  if (lexer->lookahead != '}') return false;
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  state->expect_literal_close = false;
  lexer->result_symbol = LITERAL_CLOSE_TAG;
  return true;
}

static bool scan_text(TSLexer *lexer, bool has_content) {
  while (!lexer->eof(lexer)) {
    if (lexer->lookahead == '{') {
      // A left delimiter followed by whitespace, another left delimiter, or
      // the right delimiter is auto-literal text in Smarty's default mode.
      lexer->mark_end(lexer);
      lexer->advance(lexer, false);
      if (lexer->lookahead == '{' || lexer->lookahead == '}' ||
          lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
          lexer->lookahead == '\n' || lexer->lookahead == '\v' ||
          lexer->lookahead == '\f' || lexer->lookahead == '\r') {
        has_content = true;
        if (lexer->lookahead == '}') lexer->advance(lexer, false);
        lexer->mark_end(lexer);
        continue;
      }
      if (!has_content) return false;
      lexer->result_symbol = TEXT;
      return true;
    }

    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    has_content = true;
  }

  if (has_content) {
    lexer->result_symbol = TEXT;
    return true;
  }
  return false;
}

// Called with '$' current. Smarty's ID permits a digit prefix, but must contain
// a letter or underscore. The consumed lookahead is either included in a
// literal token or discarded when a containing scanner declines its token.
static bool consume_dollar_id_start(TSLexer *lexer) {
  lexer->advance(lexer, false);
  while (is_ascii_digit(lexer->lookahead)) lexer->advance(lexer, false);
  return is_ascii_identifier_start(lexer->lookahead);
}

static bool scan_string_fragment(TSLexer *lexer, bool has_content) {

  while (!lexer->eof(lexer)) {
    if (lexer->lookahead == '"') break;

    if (lexer->lookahead == '\\') {
      lexer->advance(lexer, false);
      if (lexer->eof(lexer)) break;
      lexer->advance(lexer, false);
      has_content = true;
      lexer->mark_end(lexer);
      continue;
    }

    if (lexer->lookahead == '$') {
      if (consume_dollar_id_start(lexer)) {
        if (!has_content) return false;
        lexer->result_symbol = STRING_FRAGMENT;
        return true;
      }
      has_content = true;
      lexer->mark_end(lexer);
      continue;
    }

    if (lexer->lookahead == '{') {
      lexer->advance(lexer, false);
      if (lexer->lookahead != '}' && lexer->lookahead != '{' &&
          lexer->lookahead != ' ' && lexer->lookahead != '\t' &&
          lexer->lookahead != '\n' && lexer->lookahead != '\r' &&
          lexer->lookahead != '*') {
        if (!has_content) return false;
        lexer->result_symbol = STRING_FRAGMENT;
        return true;
      }
      if (lexer->lookahead == '}') lexer->advance(lexer, false);
      has_content = true;
      lexer->mark_end(lexer);
      continue;
    }

    if (lexer->lookahead == '`') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '$') {
        if (!has_content) return false;
        lexer->result_symbol = STRING_FRAGMENT;
        return true;
      }
      has_content = true;
      lexer->mark_end(lexer);
      continue;
    }

    lexer->advance(lexer, false);
    has_content = true;
    lexer->mark_end(lexer);
  }

  if (has_content) {
    lexer->result_symbol = STRING_FRAGMENT;
    return true;
  }
  return false;
}

void *tree_sitter_smarty2_external_scanner_create(void) { return calloc(1, sizeof(ScannerState)); }

void tree_sitter_smarty2_external_scanner_destroy(void *payload) { free(payload); }

unsigned tree_sitter_smarty2_external_scanner_serialize(void *payload, char *buffer) {
  ScannerState *state = (ScannerState *)payload;
  buffer[0] = (state->in_literal ? 1 : 0) | (state->expect_literal_close ? 2 : 0);
  return 1;
}

void tree_sitter_smarty2_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  ScannerState *state = (ScannerState *)payload;
  state->in_literal = length > 0 && (buffer[0] & 1) != 0;
  state->expect_literal_close = length > 0 && (buffer[0] & 2) != 0;
}

bool tree_sitter_smarty2_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  ScannerState *state = (ScannerState *)payload;
  if (!state->in_literal && !valid_symbols[TEXT] && !valid_symbols[TAG_ATTRIBUTE_OUTPUT_START] &&
      valid_symbols[IF_HEADER_CLOSE_RECOVERY] && scan_if_header_close_recovery(lexer)) return true;
  if (!state->in_literal && valid_symbols[TAG_ATTRIBUTE_OUTPUT_SPACE] &&
      scan_tag_attribute_output_space(lexer)) return true;
  if (!state->in_literal && valid_symbols[TAG_ATTRIBUTE_OUTPUT_START] && !valid_symbols[TEXT] &&
      scan_tag_attribute_output_start(lexer)) return true;
  if (!state->in_literal && valid_symbols[BRACKET_BRACED_INDEX_OPEN] &&
      scan_bracket_braced_index_open(lexer)) return true;
  if (!state->in_literal && !valid_symbols[TEXT] && is_smarty_whitespace(lexer->lookahead) &&
      (valid_symbols[OUTPUT_NOCACHE_NAME] || valid_symbols[WORD_AND_OPERATOR] || valid_symbols[WORD_OR_OPERATOR] ||
       valid_symbols[WORD_XOR_OPERATOR] || valid_symbols[WORD_EQUALITY_OPERATOR] ||
       valid_symbols[WORD_RELATIONAL_OPERATOR] || valid_symbols[SINGLE_CONDITION_OPERATOR]))
    return scan_gap_operator(lexer, valid_symbols);
  if (valid_symbols[LITERAL_OPENER] && scan_literal_opener(lexer, state)) return true;
  if (valid_symbols[LITERAL_CONTENT] && state->in_literal && scan_literal_content(lexer, state)) return true;
  if (valid_symbols[LITERAL_CLOSE_TAG] && (state->in_literal || state->expect_literal_close))
    return scan_literal_close(lexer, state);

  if (valid_symbols[BACKTICK_INTERPOLATION_START] && lexer->lookahead == '`') {
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    if (lexer->lookahead == '$') {
      lexer->result_symbol = BACKTICK_INTERPOLATION_START;
      return true;
    }
    if (valid_symbols[STRING_FRAGMENT] && scan_string_fragment(lexer, true)) return true;
    return false;
  }

  if (valid_symbols[STRING_FRAGMENT] && scan_string_fragment(lexer, false)) {
    return true;
  }

  if (valid_symbols[TEXT]) return scan_text(lexer, false);

  return false;
}
