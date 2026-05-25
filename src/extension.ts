import * as vscode from 'vscode';
main

// ---------------------------------------------------------------------------
// Class name detection
// ---------------------------------------------------------------------------

/**

 */
function detectClassName(
  document: vscode.TextDocument,
  fromLine: number
): string | null {

  const classPattern =
    /\bclass\s+([A-Za-z_]\w*)(?:\s+final)?\s*(?::\s*[\w\s,:<>*&]+?)?\s*\{?\s*$/;

  for (let i = fromLine; i >= 0; i--) {

}

// ---------------------------------------------------------------------------
// Type system — expanded to support templates, pointers, custom types
// ---------------------------------------------------------------------------

/**
 * How a type is treated for getter return type and setter parameter type:
 *  primitive → passed/returned by value      (int, double, bool, ...)
 *  string    → const std::string&            (std::string)
 *  pointer   → raw pointer, unchanged        (Foo*, int*)
 *  object    → const T& for anything else    (std::vector<T>, custom classes, ...)
 */
type TypeCategory = 'primitive' | 'string' | 'object' | 'pointer';

type ParsedField = {
  rawType: string;       // e.g. "std::vector<int>", "int*", "unsigned long"
  name: string;
  category: TypeCategory;
};

const PRIMITIVE_TYPES = new Set([
  'int', 'double', 'float', 'char', 'bool', 'long', 'short',
  'size_t', 'ptrdiff_t',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
  'int8_t',  'int16_t',  'int32_t',  'int64_t',
  'unsigned int', 'unsigned long', 'unsigned char', 'unsigned short',
  'long long', 'unsigned long long', 'long double',
]);

function classifyType(typeStr: string): TypeCategory {
  if (typeStr.endsWith('*'))                              { return 'pointer';   }
  if (typeStr === 'std::string' || typeStr === 'string') { return 'string';    }
  if (PRIMITIVE_TYPES.has(typeStr))                      { return 'primitive'; }
  return 'object';
}

/**
 * Parses a single C++ member variable declaration line.
 * Handles: templates, pointers, custom types, multi-word primitives.
 * Skips: const members, static members, lines that aren't declarations.
 */
function parseFieldLine(line: string): ParsedField | null {
  let s = line.trim();
  if (!s || !s.endsWith(';')) { return null; }
  s = s.slice(0, -1).trim();
  if (!s) { return null; }

  // Strip access specifiers at the start of a line (e.g. "public: int x")
  s = s.replace(/^(public|protected|private)\s*:\s*/, '');

  // Skip const member variables (they need only getters — future feature)
  if (/^\s*const\b/.test(s)) { return null; }

  // Strip storage/cv qualifiers
  s = s.replace(/\b(static|mutable|volatile|inline|explicit)\b\s*/g, '').trim();

  // Remove initializer:  int x = 5  →  int x
  s = s.replace(/\s*=\s*[^=].*$/, '').trim();

  // Normalize pointer asterisk so it sticks to the type, not the name:
  //   "int *ptr"  →  "int* ptr"
  //   "Foo * bar" →  "Foo* bar"
  s = s.replace(/(\w)\s*\*\s*([A-Za-z_])/, '$1* $2');

  // Extract the variable name — last valid C++ identifier in the string
  const nameMatch = /([A-Za-z_]\w*)\s*$/.exec(s);
  if (!nameMatch) { return null; }
  const name = nameMatch[1];

  // Everything before the name is the type
  let typeStr = s.slice(0, nameMatch.index).trim();
  if (!typeStr) { return null; }

  // Validate template angle brackets are balanced
  let depth = 0;
  for (const ch of typeStr) {
    if (ch === '<') { depth++; }
    if (ch === '>') { depth--; }
    if (depth < 0)  { return null; }
  }
  if (depth !== 0) { return null; }

  // Type must start with a valid identifier or :: (e.g. ::std::string)
  if (!/^[A-Za-z_:]/.test(typeStr)) { return null; }
  // Variable name must be a valid identifier
  if (!/^[A-Za-z_]\w*$/.test(name)) { return null; }

  return { rawType: typeStr, name, category: classifyType(typeStr) };
}

// ---------------------------------------------------------------------------
// Getter / Setter naming
// ---------------------------------------------------------------------------

function capitalizeFirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function isBoolGetterName(varName: string): boolean {
  return varName.startsWith('is') || varName.startsWith('has');
}

function getterName(rawType: string, varName: string): string {
  if (rawType === 'bool' && isBoolGetterName(varName)) { return varName; }
  return `get${capitalizeFirst(varName)}`;
}

function setterName(varName: string): string {
  return `set${capitalizeFirst(varName)}`;
}

function getterReturnType(rawType: string, category: TypeCategory): string {
  switch (category) {
    case 'primitive': return rawType;
    case 'string':    return 'const std::string&';
    case 'pointer':   return rawType;
    case 'object':    return `const ${rawType}&`;
  }
}

function setterParamType(rawType: string, category: TypeCategory): string {
  switch (category) {
    case 'primitive': return rawType;
    case 'string':    return 'const std::string&';
    case 'pointer':   return rawType;
    case 'object':    return `const ${rawType}&`;
  }
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

function generateGetterSetterCode(
  className: string,
  fields: ParsedField[]
): { hpp: string; cpp: string } {
  const hppLines: string[] = [];
  const cppLines: string[] = [];

  for (const f of fields) {
    const gName  = getterName(f.rawType, f.name);
    const sName  = setterName(f.name);
    const gRet   = getterReturnType(f.rawType, f.category);
    const sParam = setterParamType(f.rawType, f.category);

    // HPP declarations (indented, ready to paste inside a class body)
    hppLines.push(`  ${gRet} ${gName}() const;`);
    hppLines.push(`  void ${sName}(${sParam} ${f.name});`);
    hppLines.push('');

    // CPP definitions
    cppLines.push(`${gRet} ${className}::${gName}() const {`);
    cppLines.push(`  return ${f.name};`);
    cppLines.push(`}`);
    cppLines.push('');
    cppLines.push(`void ${className}::${sName}(${sParam} ${f.name}) {`);
    cppLines.push(`  this->${f.name} = ${f.name};`);
    cppLines.push(`}`);
    cppLines.push('');
  }

  return {
    hpp: hppLines.join('\n').trimEnd(),
    cpp: cppLines.join('\n').trimEnd(),
  };
}

// ---------------------------------------------------------------------------
// Direct file insertion
// ---------------------------------------------------------------------------

/**
 * Looks for a paired .cpp / .cc / .cxx file next to the given .hpp path.
 * Falls back to a workspace-wide search, and a QuickPick if multiple match.
 */
async function findPairedCppFile(hppPath: string): Promise<vscode.Uri | null> {
  const dir  = path.dirname(hppPath);
  const base = path.basename(hppPath, path.extname(hppPath));

  for (const ext of ['.cpp', '.cc', '.cxx']) {
    const uri = vscode.Uri.file(path.join(dir, base + ext));
    try {
      await vscode.workspace.fs.stat(uri);
      return uri;
    } catch { /* not found */ }
  }

  // Workspace-wide fallback
  const found = await vscode.workspace.findFiles(
    `**/${base}.{cpp,cc,cxx}`, '**/node_modules/**', 5
  );
  if (found.length === 1) { return found[0]; }
  if (found.length > 1) {
    const items = found.map(u => ({
      label: vscode.workspace.asRelativePath(u),
      uri: u,
    }));
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Multiple .cpp files found — pick the one to insert into',
    });
    return picked?.uri ?? null;
  }
  return null;
}

/** Inserts HPP declarations right after the last selected line. */
async function insertIntoHpp(
  editor: vscode.TextEditor,
  selection: vscode.Selection,
  hppCode: string
): Promise<void> {
  const insertPos = new vscode.Position(selection.end.line + 1, 0);
  const snippet   = `\n  // --- Getters & Setters (auto-generated) ---\n${hppCode}\n`;
  await editor.edit(eb => eb.insert(insertPos, snippet));
}

/** Opens the .cpp file and appends definitions at the end. */
async function insertIntoCpp(
  cppUri: vscode.Uri,
  cppCode: string,
  className: string
): Promise<void> {
  const doc    = await vscode.workspace.openTextDocument(cppUri);
  const editor = await vscode.window.showTextDocument(doc, { preview: false });
  const last   = doc.lineCount - 1;
  const endPos = new vscode.Position(last, doc.lineAt(last).text.length);
  const snippet = `\n// --- ${className} Getters & Setters (auto-generated) ---\n${cppCode}\n`;
  await editor.edit(eb => eb.insert(endPos, snippet));
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'get-set-plus-plus.Generate',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found.');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showErrorMessage(
          'Please select one or more member variable lines.'
        );
        return;
      }

      // Parse selected lines
      const fields = editor.document
        .getText(selection)
        .split(/\r?\n/)
        .map(parseFieldLine)
        .filter((x): x is ParsedField => x !== null);

      if (fields.length === 0) {
        vscode.window.showErrorMessage(
          'No supported fields found. Select C++ member variable declarations (e.g. "int health;", "std::vector<int> items;").'
        );
        return;
      }



      const code = generateGetterSetterCode(className, fields);

      // Let the user choose: insert into files or open preview tab
      const choice = await vscode.window.showQuickPick(
        [
          {
            label: '$(file-code)  Insert into files',
            description: 'Adds declarations here and definitions to the paired .cpp',
            value: 'insert',
          },
          {
            label: '$(open-preview)  Preview in new tab',
            description: 'Shows generated code in a read-only tab — copy manually',
            value: 'preview',
          },
        ],
        { placeHolder: 'How do you want to use the generated code?' }
      );

      if (!choice) { return; }

      if (choice.value === 'insert') {
        // 1. Insert declarations into the current .hpp file
        await insertIntoHpp(editor, selection, code.hpp);

        // 2. Find and insert definitions into the paired .cpp
        const filePath = editor.document.uri.fsPath;
        const cppUri   = await findPairedCppFile(filePath);

        if (cppUri) {
          await insertIntoCpp(cppUri, code.cpp, className);
          vscode.window.showInformationMessage(
            `✅ Inserted into ${path.basename(filePath)} and ${path.basename(cppUri.fsPath)}`
          );
        } else {
          vscode.window.showWarningMessage(
            'No paired .cpp file found. Declarations inserted into .hpp — showing .cpp definitions in preview.'
          );
          const doc = await vscode.workspace.openTextDocument({
            content: `// ===== ${className}.cpp =====\n${code.cpp}\n`,
            language: 'cpp',
          });
          await vscode.window.showTextDocument(doc, { preview: false });
        }
      } else {
        // Preview tab (original behaviour)
        const doc = await vscode.workspace.openTextDocument({
          content:
            `// ===== ${className}.hpp =====\n${code.hpp}\n\n` +
            `// ===== ${className}.cpp =====\n${code.cpp}\n`,
          language: 'cpp',
        });
        await vscode.window.showTextDocument(doc, { preview: false });
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
