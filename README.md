```
 ██████╗ ███████╗████████╗     ███████╗███████╗████████╗
██╔════╝ ██╔════╝╚══██╔══╝     ██╔════╝██╔════╝╚══██╔══╝
██║  ███╗█████╗     ██║        ███████╗█████╗     ██║
██║   ██║██╔══╝     ██║        ╚════██║██╔══╝     ██║
╚██████╔╝███████╗   ██║        ███████║███████╗   ██║
 ╚═════╝ ╚══════╝   ╚═╝        ╚══════╝╚══════╝   ╚═╝
                  + +     + +
```

# get-set-plus-plus

[![Version](https://vsmarketplacebadges.dev/version-short/IntisarWaheed.get-set-plus-plus.svg)](https://marketplace.visualstudio.com/items?itemName=IntisarWaheed.get-set-plus-plus)
[![Installs](https://vsmarketplacebadges.dev/installs-short/IntisarWaheed.get-set-plus-plus.svg)](https://marketplace.visualstudio.com/items?itemName=IntisarWaheed.get-set-plus-plus)
[![Downloads](https://vsmarketplacebadges.dev/downloads-short/IntisarWaheed.get-set-plus-plus.svg)](https://marketplace.visualstudio.com/items?itemName=IntisarWaheed.get-set-plus-plus)
[![Rating](https://vsmarketplacebadges.dev/rating-star/IntisarWaheed.get-set-plus-plus.svg)](https://marketplace.visualstudio.com/items?itemName=IntisarWaheed.get-set-plus-plus&ssr=false#review-details)

A VS Code extension that auto-generates idiomatic C++ getters and setters and inserts them directly into your paired `.hpp` and `.cpp` files. No more boilerplate.

## Install

**From the Marketplace:**
- [Install from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=IntisarWaheed.get-set-plus-plus)
- Or from inside VS Code: open Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`), search `get-set-plus-plus`, click Install.

## Features

- **Auto-detects the enclosing class name** — scans backwards from your selection, handles `class Foo`, `class Foo final`, `class Foo : public Bar, private Baz`, and multi-line declarations. Falls back to a validated input box if it can't find one.
- **Inserts directly into your files** — adds declarations into the `.hpp` after your selection, and definitions into the paired `.cpp` (auto-finds `.cpp` / `.cc` / `.cxx`, with a quick-pick menu if multiple match). Preview-in-new-tab mode is also available.
- **Broad type support:**
  - All primitives (`int`, `double`, `float`, `char`, `bool`, `long`, `short`, `size_t`, fixed-width ints like `uint32_t`, unsigned variants, `long long`, `long double`)
  - `std::string` — returned as `const std::string&` (correct C++ practice)
  - Template types (`std::vector<T>`, nested templates like `std::map<std::string, int>`)
  - Raw pointers (`Foo*`, `int*` — also normalizes `int *ptr` syntax)
  - Custom object types — returned as `const T&`
- **`const` member handling** — generates only the getter, no setter (since `const` members can't be reassigned).
- **Skips access specifiers, qualifiers, and initializers** — `public:`, `private:`, `static`, `mutable`, `volatile`, `inline`, `explicit`, and default initializers (`int x = 5;`) are stripped automatically.
- **`bool` naming conventions** — fields starting with `is` / `has` skip the `get` prefix (e.g. `bool isAlive` → `bool isAlive()`, not `getIsAlive()`).
- **Duplicate detection** — scans existing methods in the file and skips fields whose getter/setter already exists. Safe to re-run on the same selection.
- **Keybinding** — `Ctrl+Shift+G` / `Cmd+Shift+G` triggers generation when an editor is focused.

## Usage

1. Open a `.hpp` file containing a class.
2. Select one or more member variable lines (e.g. `int age;`, `std::string name;`, `std::vector<int> inventory;`).
3. Press `Ctrl+Shift+G` (`Cmd+Shift+G` on Mac), or open the Command Palette and run **Get Set ++: Generate Getters and Setters**.
4. Choose **Insert into files** (writes declarations into the `.hpp` and definitions into the paired `.cpp`) or **Preview in new tab** (shows the generated code without modifying anything).

## Example

Select these lines in your `Player.hpp`:

```cpp
int health;
std::string name;
const int maxHealth;
std::vector<int> inventory;
```

Generated `.hpp` insertion:

```cpp
  int getHealth() const;
  void setHealth(int health);

  const std::string& getName() const;
  void setName(const std::string& name);

  int getMaxHealth() const;

  const std::vector<int>& getInventory() const;
  void setInventory(const std::vector<int>& inventory);
```

Generated `.cpp` insertion:

```cpp
int Player::getHealth() const {
  return health;
}

void Player::setHealth(int health) {
  this->health = health;
}

// ... (and so on for the rest)
```

## Extension Settings

No configuration required.

## Known Limitations

- References (`Foo&`) are not currently supported as field types.
- The `.cpp` definitions are appended to the end of the file — if your file ends inside a namespace block, you may need to move the inserted code inside it.
- Generated declarations are inserted using the access modifier currently in effect at your selection point. If you select fields in a `private:` block, the auto-generated methods land in `private:` too — add a `public:` line above your selection if needed.

## Contributing

Issues and PRs welcome at the [GitHub repo](https://github.com/Intisarw/get-set-plus-plus). The codebase is split into `src/utils.ts` (pure logic, fully unit-tested) and `src/extension.ts` (VS Code integration), so most contributions can be tested without spinning up an extension host.

## Release Notes

### v0.3.0
- Direct file insertion into paired `.hpp` and `.cpp` (with `.cc` / `.cxx` fallback and quick-pick for multiple matches)
- Full template-type, pointer, and custom-object support
- `const` member handling (getter-only generation)
- Duplicate detection — re-running on the same selection skips already-generated methods
- Strips access specifiers, `static`, `mutable`, `volatile`, `inline`, `explicit`, and default initializers
- Keybinding: `Ctrl+Shift+G` / `Cmd+Shift+G`
- Refactored into testable architecture (`utils.ts` / `extension.ts`) with 70+ unit tests

### v0.2.0
- Automatic class name detection (scans backwards from selection)
- Input box fallback when class cannot be detected

### v0.1.0
- Initial release: basic getter/setter generation for primitive types

