import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Frontend JavaScript Syntax Integrity & Parse Test', async (t) => {
  const publicJsDir = path.join(process.cwd(), 'public', 'js');
  const files = fs.readdirSync(publicJsDir).filter(f => f.endsWith('.js'));

  for (const file of files) {
    await t.test(`Syntax Check: public/js/${file}`, () => {
      const filePath = path.join(publicJsDir, file);
      const code = fs.readFileSync(filePath, 'utf8');

      try {
        // Evaluate script using Function constructor to catch top-level SyntaxErrors (e.g. duplicate const/let)
        new Function(code);
      } catch (err) {
        if (err instanceof SyntaxError) {
          assert.fail(`SyntaxError in public/js/${file}: ${err.message}`);
        }
      }
    });
  }
});
