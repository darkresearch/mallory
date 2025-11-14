#!/usr/bin/env bun
import { execSync } from 'node:child_process';
import process from 'node:process';

const ALLOWED = new Set([
  'README.md',
  'CONTRIBUTING.md',
  '.github/PULL_REQUEST_TEMPLATE.md'
]);

function getTrackedMarkdownFiles() {
  try {
    const output = execSync("git ls-files '*.md'", { encoding: 'utf8' });
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch (error) {
    console.error('Failed to list tracked markdown files via git ls-files');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const markdownFiles = getTrackedMarkdownFiles();
const violations = markdownFiles.filter((file) => !ALLOWED.has(file));

if (violations.length > 0) {
  console.error('🚫 Markdown guard failed. The following tracked .md files are not whitelisted:');
  for (const file of violations) {
    console.error(`  - ${file}`);
  }
  console.error('\nPlease rename or remove these files, or explicitly add them to the whitelist in scripts/markdown-guard.mjs.');
  process.exit(1);
} else {
  console.log('✅ Markdown guard passed.');
}
