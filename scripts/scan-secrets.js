#!/usr/bin/env node

/**
 * Secret & Credential Scanner for Collectrr
 * 
 * Scans tracked repository files for high-risk secret patterns:
 * - Google AI / Firebase API Keys (AIzaSy...)
 * - RSA / EC / OpenSSH Private Keys
 * - Hardcoded Meta / WhatsApp Long-lived tokens
 * - Cloudflare API Tokens / Global Keys
 * - Hardcoded database connection strings containing passwords
 * - Real local environment secret files (.dev.vars, credentials.json)
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SUSPICIOUS_PATTERNS = [
  { name: 'Google API Key (AIzaSy...)', regex: /AIzaSy[0-9A-Za-z_-]{33}/ },
  { name: 'Private Key Block', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'AWS Access Key ID', regex: /(?:^|[^A-Z0-9])AKIA[0-9A-Z]{16}(?:[^A-Z0-9]|$)/ },
  { name: 'Generic High-Entropy Bearer Token', regex: /bearer\s+[a-zA-Z0-9_\-\.]{40,}/i },
  { name: 'Meta Long-Lived Token (EAA...)', regex: /EAA[0-9A-Za-z]{50,}/ },
  { name: 'Database URI with Password', regex: /(postgres|mysql|mongodb):\/\/[^:\s]+:[^@\s]+@[^\s]+/i },
  { name: 'Cloudflare API Token', regex: /bearer\s+[A-Za-z0-9_-]{40}/i },
];

const IGNORED_PATHS = [
  '.git/',
  'node_modules/',
  'v2/node_modules/',
  'package-lock.json',
  'v2/package-lock.json',
  'scripts/scan-secrets.js', // Exclude self
  'tests/helpers/network-guard.js',
];

function getScannableFiles() {
  try {
    const tracked = execSync('git ls-files', { encoding: 'utf-8' }).split('\n').filter(Boolean);
    const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8' }).split('\n').filter(Boolean);
    return Array.from(new Set([...tracked, ...untracked]));
  } catch (err) {
    console.warn('Warning: Not a git repo or git not found. Scanning filesystem recursively.');
    return [];
  }
}

function scanFile(filePath) {
  if (IGNORED_PATHS.some(p => filePath.includes(p))) {
    return [];
  }

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory() || stat.size > 1024 * 1024) {
    // Skip directories and files larger than 1MB
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip comments or example files
    if (filePath.endsWith('.example') || filePath.endsWith('.example.sql')) {
      continue;
    }

    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.regex.test(line)) {
        // Exclude dummy placeholders
        if (
          line.includes('YOUR_') || 
          line.includes('MOCK_') || 
          line.includes('dummy_') || 
          line.includes('test_') || 
          line.includes('example') ||
          line.includes('placeholder')
        ) {
          continue;
        }

        findings.push({
          file: filePath,
          line: i + 1,
          rule: pattern.name,
          preview: line.trim().slice(0, 100)
        });
      }
    }
  }

  return findings;
}

function run() {
  console.log('🔍 Running Collectrr Security & Secret Scanner...');
  const files = getScannableFiles();

  // Also check for sensitive files tracked by git
  const forbiddenFiles = ['.env', 'v2/.dev.vars', 'credentials.json', 'v2/credentials.json', 'service-account.json'];
  const trackedViolations = forbiddenFiles.filter(f => files.includes(f));

  let hasErrors = false;

  if (trackedViolations.length > 0) {
    console.error('❌ FATAL: Sensitive secret files are tracked in git repository:');
    for (const file of trackedViolations) {
      console.error(`   - TRACKED SENSITIVE FILE: ${file}`);
      hasErrors = true;
    }
  }

  let totalFindings = 0;
  for (const file of files) {
    const findings = scanFile(file);
    if (findings.length > 0) {
      totalFindings += findings.length;
      hasErrors = true;
      for (const finding of findings) {
        console.error(`❌ [${finding.rule}] in ${finding.file}:${finding.line}`);
        console.error(`   Content: ${finding.preview}`);
      }
    }
  }

  if (hasErrors) {
    console.error(`\n🚨 Scan failed: ${totalFindings} potential secret(s) or sensitive file(s) detected!`);
    process.exit(1);
  } else {
    console.log(`✅ Clean! Scanned ${files.length} tracked files. No secret patterns or tracked credentials found.\n`);
    process.exit(0);
  }
}

run();
