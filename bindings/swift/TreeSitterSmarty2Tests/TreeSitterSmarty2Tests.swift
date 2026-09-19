import XCTest
import SwiftTreeSitter
import TreeSitterSmarty2

final class TreeSitterSmarty2Tests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_smarty2())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Smarty2 grammar")
    }
}
