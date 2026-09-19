// swift-tools-version:5.3

import Foundation
import PackageDescription

var sources = ["src/parser.c"]
if FileManager.default.fileExists(atPath: "src/scanner.c") {
    sources.append("src/scanner.c")
}

let package = Package(
    name: "TreeSitterSmarty2",
    products: [
        .library(name: "TreeSitterSmarty2", targets: ["TreeSitterSmarty2"]),
    ],
    dependencies: [
        .package(name: "SwiftTreeSitter", url: "https://github.com/tree-sitter/swift-tree-sitter", from: "0.9.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterSmarty2",
            dependencies: [],
            path: ".",
            sources: sources,
            resources: [
                .copy("queries")
            ],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterSmarty2Tests",
            dependencies: [
                "SwiftTreeSitter",
                "TreeSitterSmarty2",
            ],
            path: "bindings/swift/TreeSitterSmarty2Tests"
        )
    ],
    cLanguageStandard: .c11
)
