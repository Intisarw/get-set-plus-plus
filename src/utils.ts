/**
 * utils.ts — pure logic for get-set-plus-plus
 *
 * All functions here are free of VS Code API dependencies so they can be
 * imported directly by the test suite without spinning up an extension host.
 */

// ---------------------------------------------------------------------------
// Type system
// ---------------------------------------------------------------------------

export type TypeCategory = 'primitive' | 'string' | 'object' | 'pointer';

export type ParsedField = {
  rawType:  string;
  name:     string;
  category: TypeCategory;
  isConst:  boolean;
};

export const PRIMITIVE_TYPES = new Set([
  'int', 'double', 'float', 'char', 'bool', 'long', 'short',
  'size_t', 'ptrdiff_t',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
  'int8_t',  'int16_t',  'int32_t',  'int64_t',
  'unsigned int', 'unsigned long', 'unsigned char', 'unsigned short',
  'long long', 'unsigned long long', 'long double',
]);

export function classifyType(typeStr: string): TypeCategory {
  if (typeStr.endsWith('*'))                              { return 'pointer';   }
  if (typeStr === 'std::string' || typeStr === 'string') { return 'string';    }
  if (PRIMITIVE_TYPES.has(typeStr))                      { return 'primitive'; }
  return 'object';
}

// ---------------------------------------------------------------------------
// Field parsing
// ---------------------------------------------------------------------------

export function parseFieldLine(line: string): ParsedField | null {
  let s = line.trim();
  if (!s || !s.endsWith(';')) { return null; }
  s = s.slice(0, -1).trim();
  if (!s) { return null; }

  s = s.replace(/^(public|protected|private)\s*:\s*/, '');

  const isConst = /^\s*const\b/.test(s);
  if (isConst) { s = s.replace(/^\s*const\s+/, '').trim(); }

  s = s.replace(/\b(static|mutable|volatile|inline|explicit)\b\s*/g, '').trim();
  s = s.replace(/\s*=\s*[^=].*$/, '').trim();
  s = s.replace(/(\w)\s*\*\s*([A-Za-z_])/, '$1* $2');

  const nameMatch = /([A-Za-z_]\w*)\s*$/.exec(s);
  if (!nameMatch) { return null; }
  const name = nameMatch[1];

  let typeStr = s.slice(0, nameMatch.index).trim();
  if (!typeStr) { return null; }

  let depth = 0;
  for (const ch of typeStr) {
    if (ch === '<') { depth++; }
    if (ch === '>') { depth--; }
    if (depth < 0)  { return null; }
  }
  if (depth !== 0) { return null; }

  if (!/^[A-Za-z_:]/.test(typeStr)) { return null; }
  if (!/^[A-Za-z_]\w*$/.test(name)) { return null; }

  return { rawType: typeStr, name, category: classifyType(typeStr), isConst };
}

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

export function capitalizeFirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function isBoolGetterName(varName: string): boolean {
  return varName.startsWith('is') || varName.startsWith('has');
}

export function getterName(rawType: string, varName: string): string {
  if (rawType === 'bool' && isBoolGetterName(varName)) { return varName; }
  return `get${capitalizeFirst(varName)}`;
}

export function setterName(varName: string): string {
  return `set${capitalizeFirst(varName)}`;
}

export function getterReturnType(rawType: string, category: TypeCategory): string {
  switch (category) {
    case 'primitive': return rawType;
    case 'string':    return 'const std::string&';
    case 'pointer':   return rawType;
    case 'object':    return `const ${rawType}&`;
  }
}

export function setterParamType(rawType: string, category: TypeCategory): string {
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

export function generateGetterSetterCode(
  className: string,
  fields: ParsedField[]
): { hpp: string; cpp: string } {
  const hppLines: string[] = [];
  const cppLines: string[] = [];

  for (const f of fields) {
    const gName = getterName(f.rawType, f.name);
    const gRet  = getterReturnType(f.rawType, f.category);

    hppLines.push(`  ${gRet} ${gName}() const;`);
    cppLines.push(`${gRet} ${className}::${gName}() const {`);
    cppLines.push(`  return ${f.name};`);
    cppLines.push(`}`);
    cppLines.push('');

    if (!f.isConst) {
      const sName  = setterName(f.name);
      const sParam = setterParamType(f.rawType, f.category);
      hppLines.push(`  void ${sName}(${sParam} ${f.name});`);
      cppLines.push(`void ${className}::${sName}(${sParam} ${f.name}) {`);
      cppLines.push(`  this->${f.name} = ${f.name};`);
      cppLines.push(`}`);
      cppLines.push('');
    }

    hppLines.push('');
  }

  return {
    hpp: hppLines.join('\n').trimEnd(),
    cpp: cppLines.join('\n').trimEnd(),
  };
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export function filterDuplicates(
  fields: ParsedField[],
  existing: Set<string>
): { toGenerate: ParsedField[]; skipped: string[] } {
  const toGenerate: ParsedField[] = [];
  const skipped: string[] = [];

  for (const f of fields) {
    const gName = getterName(f.rawType, f.name);
    const sName = setterName(f.name);
    if (existing.has(gName) || (!f.isConst && existing.has(sName))) {
      skipped.push(f.name);
    } else {
      toGenerate.push(f);
    }
  }

  return { toGenerate, skipped };
}
