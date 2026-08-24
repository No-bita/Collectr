import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Multi-Variant Persona Copy System Tests', async (t) => {
  const variantConfigPath = path.join(process.cwd(), 'public', 'js', 'variant-config.js');

  await t.test('1. variant-config.js script file exists', () => {
    assert.strictEqual(fs.existsSync(variantConfigPath), true, 'variant-config.js should exist in public/js/');
  });

  await t.test('2. VARIANT_COPY contains complete ca and loan_agent persona definitions', () => {
    const fileContent = fs.readFileSync(variantConfigPath, 'utf8');
    
    // Evaluate in mock browser environment
    const mockWindow = {};
    const evalFn = new Function('window', 'document', 'localStorage', 'location', fileContent);
    evalFn(mockWindow, { addEventListener: () => {} }, { getItem: () => null, setItem: () => {} }, { search: '', pathname: '/' });

    assert.ok(mockWindow.VARIANT_COPY, 'window.VARIANT_COPY should be defined');
    assert.ok(mockWindow.VARIANT_COPY.ca, 'ca persona copy missing');
    assert.ok(mockWindow.VARIANT_COPY.loan_agent, 'loan_agent persona copy missing');

    const requiredKeys = [
      'id', 'name', 'heroBadge', 'heroTitleLead', 'heroTitleItalic',
      'heroSubtitle', 'bullet1', 'bullet2', 'bullet3',
      'problemTitle', 'problem1Title', 'problem1Body',
      'dashboardHeader', 'dashboardNewBtn', 'dashboardSearchPlaceholder'
    ];

    ['ca', 'loan_agent'].forEach(personaKey => {
      const copyObj = mockWindow.VARIANT_COPY[personaKey];
      requiredKeys.forEach(k => {
        assert.ok(copyObj[k], `Missing required copy key '${k}' for persona '${personaKey}'`);
        assert.strictEqual(typeof copyObj[k], 'string', `Copy key '${k}' for '${personaKey}' must be a string`);
        assert.ok(copyObj[k].length > 0, `Copy key '${k}' for '${personaKey}' must not be empty`);
      });
    });
  });

  await t.test('3. getVariantKey() defaults to CA persona when no URL params present', () => {
    const fileContent = fs.readFileSync(variantConfigPath, 'utf8');
    const mockWindow = { location: { search: '', pathname: '/' } };
    const evalFn = new Function('window', 'document', 'localStorage', 'location', fileContent);
    evalFn(mockWindow, { addEventListener: () => {} }, { getItem: () => null, setItem: () => {} }, mockWindow.location);

    assert.strictEqual(mockWindow.getVariantKey(), 'ca', 'Default variant should be ca');
  });

  await t.test('4. getVariantKey() respects ?variant=loan_agent URL parameter', () => {
    const fileContent = fs.readFileSync(variantConfigPath, 'utf8');
    const mockWindow = { location: { search: '?variant=loan_agent', pathname: '/' } };
    const mockLocalStorage = {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = v; }
    };
    const evalFn = new Function('window', 'document', 'localStorage', 'location', fileContent);
    evalFn(mockWindow, { addEventListener: () => {} }, mockLocalStorage, mockWindow.location);

    assert.strictEqual(mockWindow.getVariantKey(), 'loan_agent', 'Should resolve variant to loan_agent');
    assert.strictEqual(mockLocalStorage.getItem('collectr_variant'), 'loan_agent', 'Should persist variant in localStorage');
  });
});
