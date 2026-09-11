## Description

Please include a summary of the change, motivation, and context. List any dependencies that are required for this change.

Fixes #(issue)

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring or code structure improvement
- [ ] Documentation update

## Checklist

- [ ] My code adheres to the project's style guidelines.
- [ ] I have not added unnecessary microcopy below headings or buttons (`AGENTS.md`).
- [ ] I have performed a self-review of my own code.
- [ ] I have added tests that prove my fix is effective or that my feature works.
- [ ] All existing and new tests pass locally (`npm run test:offline`).
- [ ] Deep schema parity checks pass (`node --test v2/tests/schema-parity.test.js`).
- [ ] Secret scanner has been run and passes (`node scripts/scan-secrets.js`).
- [ ] No secrets, real phone numbers, or private API keys have been committed.
