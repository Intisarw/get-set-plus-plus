import * as vscode from 'vscode';
import * as path from 'path';
import {
  ParsedField,
  parseFieldLine,
  generateGetterSetterCode,
  filterDuplicates,
} from './utils';

// ---------------------------------------------------------------------------
// Class name detection  (uses VS Code API — stays here)
// ---------------------------------------------------------------------------

function detectClassName(
  document: vscode.TextDocument,
  fromLine: number
): string | null {
  const classPattern =
    /\bclass\s+([A-Za-z_]\w*)(?:\s+final)?\s*(?::\s*[\w\s,:<>*&]+?)?\s*\{?\s*$/;
  for (let i = fromLine; i >= 0; i--) {
    const match = classPattern.exec(document.lineAt(i).text);
    if (match) { return match[1]; }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Duplicate detection  (uses VS Code API — stays here)
// ---------------------------------------------------------------------------

function existingMethodNames(document: vscode.TextDocument): Set<string> {
  const names = new Set<string>();
  const methodPattern = /\b([A-Za-z_]\w*)\s*\(/g;
  const text = document.getText();
  let m: RegExpExecArray | null;
  while ((m = methodPattern.exec(text)) !== null) { names.add(m[1]); }
  return names;
}

// ---------------------------------------------------------------------------
// File insertion
// ---------------------------------------------------------------------------

async function findPairedCppFile(hppPath: string): Promise<vscode.Uri | null> {
  const dir  = path.dirname(hppPath);
  const base = path.basename(hppPath, path.extname(hppPath));

  for (const ext of ['.cpp', '.cc', '.cxx']) {
    const uri = vscode.Uri.file(path.join(dir, base + ext));
    try { await vscode.workspace.fs.stat(uri); return uri; }
    catch { /* not found */ }
  }

  const found = await vscode.workspace.findFiles(
    `**/${base}.{cpp,cc,cxx}`, '**/node_modules/**', 5
  );
  if (found.length === 1) { return found[0]; }
  if (found.length > 1) {
    const items = found.map(u => ({ label: vscode.workspace.asRelativePath(u), uri: u }));
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Multiple .cpp files found — pick the one to insert into',
    });
    return picked?.uri ?? null;
  }
  return null;
}

async function insertIntoHpp(
  editor: vscode.TextEditor,
  selection: vscode.Selection,
  hppCode: string
): Promise<void> {
  const insertPos = new vscode.Position(selection.end.line + 1, 0);
  const snippet   = `\n  // --- Getters & Setters (auto-generated) ---\n${hppCode}\n`;
  await editor.edit(eb => eb.insert(insertPos, snippet));
}

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
        vscode.window.showErrorMessage('Please select one or more member variable lines.');
        return;
      }

      const allFields = editor.document
        .getText(selection)
        .split(/\r?\n/)
        .map(parseFieldLine)
        .filter((x): x is ParsedField => x !== null);

      if (allFields.length === 0) {
        vscode.window.showErrorMessage(
          'No supported fields found. Select C++ member variable declarations ' +
          '(e.g. "int health;", "std::vector<int> items;", "const int maxHp;").'
        );
        return;
      }

      const existing = existingMethodNames(editor.document);
      const { toGenerate, skipped } = filterDuplicates(allFields, existing);

      if (skipped.length > 0) {
        vscode.window.showWarningMessage(
          `Skipped ${skipped.length} field(s) — getter/setter already exists: ${skipped.join(', ')}`
        );
      }
      if (toGenerate.length === 0) {
        vscode.window.showInformationMessage(
          'All selected fields already have getters/setters — nothing to generate.'
        );
        return;
      }

      let className = detectClassName(editor.document, selection.start.line);
      if (!className) {
        const input = await vscode.window.showInputBox({
          prompt: 'Could not detect class name. Enter it manually:',
          placeHolder: 'MyClass',
          validateInput: val =>
            /^[A-Za-z_]\w*$/.test(val.trim()) ? null : 'Enter a valid C++ identifier.',
        });
        if (!input) { return; }
        className = input.trim();
      }

      const code = generateGetterSetterCode(className, toGenerate);

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
        await insertIntoHpp(editor, selection, code.hpp);
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
