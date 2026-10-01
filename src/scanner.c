#include "tree_sitter/parser.h"

enum TokenType {
  TEXT,
  OUTPUT_ATTRIBUTE_ERROR_MARKER,
  STRING_FRAGMENT,
  BACKTICK_INTERPOLATION_START,
};

static bool is_ascii_digit(int32_t c) {
  return c >= '0' && c <= '9';
}

static bool is_ascii_identifier_start(int32_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_';
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

void *tree_sitter_smarty2_external_scanner_create(void) { return NULL; }

void tree_sitter_smarty2_external_scanner_destroy(void *payload) { (void)payload; }

unsigned tree_sitter_smarty2_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_smarty2_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_smarty2_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  (void)payload;

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

  if (valid_symbols[TEXT]) {
    bool has_content = false;

    while (!lexer->eof(lexer)) {
      if (lexer->lookahead == '{') {
        // An adjacent opening brace starts a Smarty construct. Save the token
        // boundary before peeking so the brace remains for the tag lexer.
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

      // In Smarty's default auto_literal mode, a raw right brace is text.
      lexer->advance(lexer, false);
      has_content = true;
      lexer->mark_end(lexer);
    }

    if (has_content) {
      lexer->result_symbol = TEXT;
      return true;
    }
  }

  return false;
}
