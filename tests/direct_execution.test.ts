import { describe, expect, it } from 'vitest';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDirectExecution } from '../src/index.js';

describe('cross-platform ESM direct execution', () => {
  const modulePath = fileURLToPath(import.meta.url);

  it('matches a module URL with its filesystem argv path', () => {
    expect(isDirectExecution(import.meta.url, modulePath)).toBe(true);
    expect(isDirectExecution(import.meta.url, relative(process.cwd(), modulePath))).toBe(true);
  });

  it('does not match a different argv path', () => {
    expect(isDirectExecution(import.meta.url, join(dirname(modulePath), 'other-entry.test.ts'))).toBe(false);
  });

  it('does not match an undefined or empty argv entry', () => {
    expect(isDirectExecution(import.meta.url, undefined)).toBe(false);
    expect(isDirectExecution(import.meta.url, '')).toBe(false);
  });

  it('compares through Node URL conversion, including escaped path characters', () => {
    const pathWithSpaces = join(dirname(modulePath), 'entry with spaces.js');
    expect(isDirectExecution(pathToFileURL(pathWithSpaces).href, pathWithSpaces)).toBe(true);
    expect(pathToFileURL(pathWithSpaces).href).toContain('%20');
  });
});
