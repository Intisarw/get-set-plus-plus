# Change Log

All notable changes to the "get-set-plus-plus" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]


## [0.3.2] - 2026-05-26

### Changed
- Rewrote README to accurately reflect v0.3.0 features (file insertion,
  full type support, const handling, duplicate detection, keybinding).
- Added Marketplace badges via `vsmarketplacebadges.dev`
  (the shields.io VS Code Marketplace endpoints were retired).
- Added install instructions and a worked example.
- Replaced stale "Known Issues" with honest current limitations.

### Fixed
- Stopped tracking macOS `.DS_Store` files in git.

## [0.2.0] - 2026-05-25

### Added
- **Automatic class name detection** — the extension now scans backwards from
  the selected lines to find the enclosing `class` declaration. Handles all
  common C++ forms:
  - `class Foo {`
  - `class Foo : public Bar {`
  - `class Foo final : public Bar, private Baz {`
  - Multi-line declarations where the opening `{` is on the next line.
- **Manual fallback** — if no class declaration can be found, a VS Code input
  box prompts the user to enter the class name manually (with identifier
  validation).

### Removed
- Hardcoded `"Restaurant"` class name placeholder.

## [0.1.0] - Initial release

- Parses selected C++ member variable lines (`int`, `double`, `bool`, `std::string`)
- Generates getter & setter declarations (`.hpp`) and definitions (`.cpp`)
- Displays generated code in a new editor tab