  ██████╗ ███████╗████████╗     ███████╗███████╗████████╗
 ██╔════╝ ██╔════╝╚══██╔══╝     ██╔════╝██╔════╝╚══██╔══╝
 ██║  ███╗█████╗     ██║        ███████╗█████╗     ██║   
 ██║   ██║██╔══╝     ██║        ╚════██║██╔══╝     ██║   
 ╚██████╔╝███████╗   ██║        ███████║███████╗   ██║   
  ╚═════╝ ╚══════╝   ╚═╝        ╚══════╝╚══════╝   ╚═╝   

                   + +     + +

Introduction: Hey everyone! This is a VS Code extension that eliminates the tedium of writing C++ getters and setters by automatically generating them for both `.hpp` declarations and `.cpp` definitions.

> **Early development** — features are being added incrementally. Contributions welcome!

# get-set-plus-plus

A VS Code extension that generates C++ getters and setters across `.hpp` and `.cpp` files.

## Features

- **Auto-detects the enclosing class name** from your file — no manual input needed
- Graceful fallback: if the class can't be detected, a prompt asks you to type it in
- Parses selected C++ member variable lines
- Supports: `int`, `double`, `bool`, `std::string`
- Generates getter & setter declarations (`.hpp`) and definitions (`.cpp`)
- Handles `bool` naming conventions — variables already starting with `is`/`has` skip the `get` prefix
- Returns `const std::string&` for string types (correct C++ practice)
- Displays generated code in a new editor tab ready to copy

## Usage

1. Open a `.hpp` file containing a class
2. Select one or more member variable lines (e.g. `int age;`)
3. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
4. Run **Get-Set-Plus-Plus: Generate Getters and Setters**
5. A new tab opens with the generated `.hpp` declarations and `.cpp` definitions

## Extension Settings

No configuration required.

## Known Issues

- Template types (`std::vector<T>`, etc.), raw pointers, and references are not yet supported
- Code is shown in a preview tab rather than inserted directly into your files (coming soon)

## Release Notes

### v0.2.0
- Automatic class name detection (scans backwards from selection)
- Input box fallback when class cannot be detected

### v0.1.0
- Initial release: basic getter/setter generation for primitive types

