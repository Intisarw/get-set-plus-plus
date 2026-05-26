import * as vscode from 'vscode';

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

    cppLines.push(`${gRet} ${className}::${gName}() const {`);
    cppLines.push(`  return ${f.name};`);
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

        .getText(selection)
        .split(/\r?\n/)
        .map(parseFieldLine)
        .filter((x): x is ParsedField => x !== null);

      if (allFields.length === 0) {
        vscode.window.showErrorMessage(

        );
        return;
      }


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
