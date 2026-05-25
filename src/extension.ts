import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Class name detection
// ---------------------------------------------------------------------------

/**
 * Scans backwards from `fromLine` in the document looking for a C++ class
 * declaration that encloses the user's selection.
 *
 * Handles all common forms:
 *   class Foo {
 *   class Foo : public Bar {
 *   class Foo final : public Bar, private Baz {
 *   class Foo        ← opening brace on the next line
 *
 * Returns the class name string, or null if none is found.
 */
function detectClassName(
  document: vscode.TextDocument,
  fromLine: number
): string | null {
  // Matches: class <Name> [final] [: ...] [{]
  // Group 1 captures the class name identifier.
  const classPattern =
    /\bclass\s+([A-Za-z_]\w*)(?:\s+final)?\s*(?::\s*[\w\s,:<>*&]+?)?\s*\{?\s*$/;

  for (let i = fromLine; i >= 0; i--) {
    const lineText = document.lineAt(i).text;
    const match = classPattern.exec(lineText);
    if (match) {
      return match[1];
    }
  }
  return null;
}

type SupportedType = 'int' | 'double' | 'bool' | 'std::string';

type ParsedField = {
	type: SupportedType;
	name: string;
}

const SUPPORTED_TYPES : SupportedType[] = ['int' , 'double', 'bool', 'std::string'];

function parseFieldLine(line:string) : ParsedField | null {
	//1)Trimming whitespace
	let s = line.trim();
	if(!s){
		return null;
	}

	//2) Must end with ;
	if(!s.endsWith(';')){
		return null;
	}

	//3) Remove trailing ; and tri again
	s = s.slice(0,-1).trim();
	if(!s) {return null;}

	//4) Collapse multiple spaces to single spaces
	s = s.replace(/\s/g, ' ');

	//5) Fast skip things we don't support yet
	// FOR NOW : Templates, pointers, references, etc.
	if(s.includes('<') || s.includes('>') || s.includes('*') || s.includes('&')) {return null;}

	// 6) Splitting into tokens
	const parts = s.split(' ');
	if(parts.length < 2) {return null;}

	// 7) Var is the last token
	const name = parts[parts.length - 1].trim();

	// 8) Type is everything before the last token
	const typeStr = parts.slice(0,-1).join(' ').trim();

	// 9) Validate supported tyoe
	if(!SUPPORTED_TYPES.includes(typeStr as SupportedType)) {return null;}

	// 10) Validate variable name (simple identifier check)
	if (!/^[A-Za-z_]\w*$/.test(name)) {return null;}

	return {type: typeStr as SupportedType, name};

}

// changes and makes the first letter capitalized
function capitalizeFirst(s: string) : string{
	if(!s) {return s;}
	return s[0].toUpperCase() +s.slice(1);
}

// bool getterName
function  isBoolGetterName(varName: string): boolean{
	return varName.startsWith('is') || varName.startsWith('has');
}

function getterName(type :string, varName: string) : string {
	if(type === 'bool' && isBoolGetterName(varName)){
		return varName;
	}
	return `get${capitalizeFirst(varName)}`;
}

function setterName(varName: string) : string{
	return `set${capitalizeFirst(varName)}`;
}

function getterReturnType(type:string): string{
	if(type === 'std::string') {return 'const std::string&';}
	return type;
}

function setterParamType(type: string): string{
	if(type === 'std::string') {return 'const std::string&';}
	return type;
}


function generateGetterSetterCode(
  className: string,
  fields: { type: string; name: string }[]
) {
  const hppLines: string[] = [];
  const cppLines: string[] = [];

  for (const f of fields) {
    const gName = getterName(f.type, f.name);
    const sName = setterName(f.name);

    const gRet = getterReturnType(f.type);
    const sParamType = setterParamType(f.type);

    // --- HPP declarations ---
    hppLines.push(`${gRet} ${gName}() const;`);
    hppLines.push(`void ${sName}(${sParamType} ${f.name});`);
    hppLines.push(''); // spacing

    // --- CPP definitions ---
    cppLines.push(`${gRet} ${className}::${gName}() const {`);
    cppLines.push(`  return ${f.name};`);
    cppLines.push(`}`);
    cppLines.push('');

    cppLines.push(`void ${className}::${sName}(${sParamType} ${f.name}) {`);
    cppLines.push(`  this->${f.name} = ${f.name};`);
    cppLines.push(`}`);
    cppLines.push('');
  }

  return {
    hpp: hppLines.join('\n').trimEnd(),
    cpp: cppLines.join('\n').trimEnd(),
  };
}

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
          'Please select class member variable in the header file'
        );
        return;
      }

      const selectedText = editor.document.getText(selection);
      const lines = selectedText.split(/\r?\n/);

      const fields = lines
        .map(parseFieldLine)
        .filter((x): x is ParsedField => x !== null);

      if (fields.length === 0) {
        vscode.window.showErrorMessage(
          'No supported fields found (int/double/bool/std::string).'
        );
        return;
      }

      // --- Class name detection ---
      // Scan backwards from the first selected line to find the enclosing class.
      let className = detectClassName(
        editor.document,
        selection.start.line
      );

      if (!className) {
        // Fallback: ask the user if we couldn't detect it automatically.
        const input = await vscode.window.showInputBox({
          prompt: 'Could not detect class name. Enter it manually:',
          placeHolder: 'MyClass',
          validateInput: (val) =>
            /^[A-Za-z_]\w*$/.test(val.trim())
              ? null
              : 'Please enter a valid C++ identifier.',
        });

        if (!input) {
          // User cancelled the input box — abort silently.
          return;
        }
        className = input.trim();
      }

      const code = generateGetterSetterCode(className, fields);

      console.log('--- HPP DECLARATIONS ---\n' + code.hpp);
      console.log('--- CPP DEFINITIONS ---\n' + code.cpp);

      const doc = await vscode.workspace.openTextDocument({
        content: `// ===== ${className}.hpp =====
${code.hpp}

// ===== ${className}.cpp =====
${code.cpp}
`,
        language: 'cpp',
      });

      await vscode.window.showTextDocument(doc, { preview: false });
	  console.log('Generating code for: ', className, fields);

    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}


