import * as assert from 'assert';
import {
  parseFieldLine,
  classifyType,
  getterName,
  setterName,
  getterReturnType,
  setterParamType,
  generateGetterSetterCode,
  filterDuplicates,
  capitalizeFirst,
} from '../utils';

// ---------------------------------------------------------------------------
// classifyType
// ---------------------------------------------------------------------------

suite('classifyType', () => {
  test('primitive types return "primitive"', () => {
    assert.strictEqual(classifyType('int'),          'primitive');
    assert.strictEqual(classifyType('double'),       'primitive');
    assert.strictEqual(classifyType('bool'),         'primitive');
    assert.strictEqual(classifyType('float'),        'primitive');
    assert.strictEqual(classifyType('long long'),    'primitive');
    assert.strictEqual(classifyType('unsigned int'), 'primitive');
  });

  test('std::string returns "string"', () => {
    assert.strictEqual(classifyType('std::string'), 'string');
    assert.strictEqual(classifyType('string'),      'string');
  });

  test('pointer types return "pointer"', () => {
    assert.strictEqual(classifyType('int*'),  'pointer');
    assert.strictEqual(classifyType('Foo*'),  'pointer');
    assert.strictEqual(classifyType('Node*'), 'pointer');
  });

  test('everything else returns "object"', () => {
    assert.strictEqual(classifyType('std::vector<int>'),           'object');
    assert.strictEqual(classifyType('std::map<std::string, int>'), 'object');
    assert.strictEqual(classifyType('Player'),                     'object');
    assert.strictEqual(classifyType('std::optional<double>'),      'object');
  });
});

// ---------------------------------------------------------------------------
// parseFieldLine
// ---------------------------------------------------------------------------

suite('parseFieldLine', () => {
  test('parses basic primitive types', () => {
    const f = parseFieldLine('  int health;');
    assert.ok(f);
    assert.strictEqual(f.rawType,  'int');
    assert.strictEqual(f.name,     'health');
    assert.strictEqual(f.category, 'primitive');
    assert.strictEqual(f.isConst,  false);
  });

  test('parses std::string', () => {
    const f = parseFieldLine('  std::string name;');
    assert.ok(f);
    assert.strictEqual(f.rawType,  'std::string');
    assert.strictEqual(f.category, 'string');
  });

  test('parses template types', () => {
    const f = parseFieldLine('  std::vector<int> inventory;');
    assert.ok(f);
    assert.strictEqual(f.rawType,  'std::vector<int>');
    assert.strictEqual(f.name,     'inventory');
    assert.strictEqual(f.category, 'object');
  });

  test('parses nested template types', () => {
    const f = parseFieldLine('  std::map<std::string, int> scores;');
    assert.ok(f);
    assert.strictEqual(f.rawType,  'std::map<std::string, int>');
    assert.strictEqual(f.category, 'object');
  });

  test('parses pointer types', () => {
    const f = parseFieldLine('  Player* target;');
    assert.ok(f);
    assert.strictEqual(f.rawType,  'Player*');
    assert.strictEqual(f.category, 'pointer');
  });

  test('normalizes "int *ptr" pointer syntax', () => {
    const f = parseFieldLine('  int *ptr;');
    assert.ok(f);
    assert.strictEqual(f.rawType, 'int*');
  });

  test('parses multi-word primitives', () => {
    const f = parseFieldLine('  unsigned int count;');
    assert.ok(f);
    assert.strictEqual(f.rawType,  'unsigned int');
    assert.strictEqual(f.category, 'primitive');
  });

  test('parses const member — isConst true, strips const from type', () => {
    const f = parseFieldLine('  const int maxHealth;');
    assert.ok(f);
    assert.strictEqual(f.rawType,  'int');
    assert.strictEqual(f.isConst,  true);
    assert.strictEqual(f.category, 'primitive');
  });

  test('strips access specifiers', () => {
    const f = parseFieldLine('  private: int secret;');
    assert.ok(f);
    assert.strictEqual(f.name, 'secret');
  });

  test('strips static qualifier', () => {
    const f = parseFieldLine('  static int instanceCount;');
    assert.ok(f);
    assert.strictEqual(f.name, 'instanceCount');
  });

  test('returns null for lines without semicolon', () => {
    assert.strictEqual(parseFieldLine('int health'), null);
  });

  test('returns null for empty lines', () => {
    assert.strictEqual(parseFieldLine(''),    null);
    assert.strictEqual(parseFieldLine('   '), null);
  });

  test('returns null for unbalanced template brackets', () => {
    assert.strictEqual(parseFieldLine('std::vector<int health;'), null);
  });

  test('returns null for method-like lines', () => {
    assert.strictEqual(parseFieldLine('  void foo();'), null);
  });
});

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

suite('capitalizeFirst', () => {
  test('capitalizes first letter', () => {
    assert.strictEqual(capitalizeFirst('health'), 'Health');
    assert.strictEqual(capitalizeFirst('name'),   'Name');
  });

  test('handles empty string', () => {
    assert.strictEqual(capitalizeFirst(''), '');
  });
});

suite('getterName', () => {
  test('regular field → getXxx', () => {
    assert.strictEqual(getterName('int',         'health'), 'getHealth');
    assert.strictEqual(getterName('std::string', 'name'),   'getName');
  });

  test('bool field starting with "is" → no get prefix', () => {
    assert.strictEqual(getterName('bool', 'isAlive'), 'isAlive');
    assert.strictEqual(getterName('bool', 'isReady'), 'isReady');
  });

  test('bool field starting with "has" → no get prefix', () => {
    assert.strictEqual(getterName('bool', 'hasAmmo'), 'hasAmmo');
  });

  test('bool field without is/has prefix → getXxx', () => {
    assert.strictEqual(getterName('bool', 'active'), 'getActive');
  });
});

suite('setterName', () => {
  test('always returns setXxx', () => {
    assert.strictEqual(setterName('health'),  'setHealth');
    assert.strictEqual(setterName('name'),    'setName');
    assert.strictEqual(setterName('isAlive'), 'setIsAlive');
  });
});

// ---------------------------------------------------------------------------
// Return / parameter types
// ---------------------------------------------------------------------------

suite('getterReturnType', () => {
  test('primitive → returned by value', () => {
    assert.strictEqual(getterReturnType('int',    'primitive'), 'int');
    assert.strictEqual(getterReturnType('double', 'primitive'), 'double');
  });

  test('string → const std::string&', () => {
    assert.strictEqual(getterReturnType('std::string', 'string'), 'const std::string&');
  });

  test('pointer → raw pointer type unchanged', () => {
    assert.strictEqual(getterReturnType('Foo*', 'pointer'), 'Foo*');
  });

  test('object → const T&', () => {
    assert.strictEqual(
      getterReturnType('std::vector<int>', 'object'),
      'const std::vector<int>&'
    );
  });
});

suite('setterParamType', () => {
  test('primitive → by value', () => {
    assert.strictEqual(setterParamType('int', 'primitive'), 'int');
  });

  test('string → const std::string&', () => {
    assert.strictEqual(setterParamType('std::string', 'string'), 'const std::string&');
  });

  test('object → const T&', () => {
    assert.strictEqual(
      setterParamType('std::vector<int>', 'object'),
      'const std::vector<int>&'
    );
  });
});

// ---------------------------------------------------------------------------
// generateGetterSetterCode
// ---------------------------------------------------------------------------

suite('generateGetterSetterCode', () => {
  test('generates getter and setter for a primitive field', () => {
    const fields = [parseFieldLine('int health;')!];
    const { hpp, cpp } = generateGetterSetterCode('Player', fields);

    assert.ok(hpp.includes('int getHealth() const;'));
    assert.ok(hpp.includes('void setHealth(int health);'));
    assert.ok(cpp.includes('int Player::getHealth() const {'));
    assert.ok(cpp.includes('void Player::setHealth(int health) {'));
    assert.ok(cpp.includes('this->health = health;'));
  });

  test('generates only getter for const field', () => {
    const fields = [parseFieldLine('const int maxHealth;')!];
    const { hpp, cpp } = generateGetterSetterCode('Player', fields);

    assert.ok(hpp.includes('int getMaxHealth() const;'));
    assert.ok(!hpp.includes('setMaxHealth'));
    assert.ok(!cpp.includes('setMaxHealth'));
  });

  test('uses const ref for std::string', () => {
    const fields = [parseFieldLine('std::string name;')!];
    const { hpp, cpp } = generateGetterSetterCode('Player', fields);

    assert.ok(hpp.includes('const std::string& getName() const;'));
    assert.ok(hpp.includes('void setName(const std::string& name);'));
    assert.ok(cpp.includes('const std::string& Player::getName() const {'));
  });

  test('uses const ref for template/object types', () => {
    const fields = [parseFieldLine('std::vector<int> items;')!];
    const { hpp, cpp } = generateGetterSetterCode('Player', fields);

    assert.ok(hpp.includes('const std::vector<int>& getItems() const;'));
    assert.ok(cpp.includes('const std::vector<int>& Player::getItems() const {'));
  });

  test('handles multiple fields in one call', () => {
    const lines = ['int health;', 'std::string name;', 'const int maxHp;'];
    const fields = lines.map(l => parseFieldLine(l)!);
    const { hpp } = generateGetterSetterCode('Player', fields);

    assert.ok(hpp.includes('getHealth'));
    assert.ok(hpp.includes('getName'));
    assert.ok(hpp.includes('getMaxHp'));
    assert.ok(!hpp.includes('setMaxHp'));
  });
});

// ---------------------------------------------------------------------------
// filterDuplicates
// ---------------------------------------------------------------------------

suite('filterDuplicates', () => {
  test('passes through all fields when nothing exists', () => {
    const fields = [parseFieldLine('int health;')!];
    const { toGenerate, skipped } = filterDuplicates(fields, new Set());
    assert.strictEqual(toGenerate.length, 1);
    assert.strictEqual(skipped.length,   0);
  });

  test('skips field whose getter already exists', () => {
    const fields = [parseFieldLine('int health;')!];
    const { toGenerate, skipped } = filterDuplicates(fields, new Set(['getHealth']));
    assert.strictEqual(toGenerate.length, 0);
    assert.strictEqual(skipped.length,   1);
    assert.strictEqual(skipped[0],       'health');
  });

  test('skips field whose setter already exists', () => {
    const fields = [parseFieldLine('int health;')!];
    const { toGenerate, skipped } = filterDuplicates(fields, new Set(['setHealth']));
    assert.strictEqual(toGenerate.length, 0);
    assert.strictEqual(skipped.length,   1);
  });

  test('const field is skipped only when getter exists, not setter', () => {
    const fields = [parseFieldLine('const int maxHp;')!];

    // setter exists but field is const — should NOT be skipped
    const { toGenerate: t1 } = filterDuplicates(fields, new Set(['setMaxHp']));
    assert.strictEqual(t1.length, 1);

    // getter exists — should be skipped
    const { toGenerate: t2, skipped } = filterDuplicates(fields, new Set(['getMaxHp']));
    assert.strictEqual(t2.length,   0);
    assert.strictEqual(skipped[0], 'maxHp');
  });

  test('filters a mixed list correctly', () => {
    const fields = [
      parseFieldLine('int health;')!,
      parseFieldLine('std::string name;')!,
    ];
    const { toGenerate, skipped } = filterDuplicates(fields, new Set(['getHealth']));
    assert.strictEqual(toGenerate.length,    1);
    assert.strictEqual(toGenerate[0].name,  'name');
    assert.strictEqual(skipped[0],          'health');
  });
});
