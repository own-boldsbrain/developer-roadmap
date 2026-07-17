import * as fs from 'fs';

export function scanForSecrets(content: string, sourceFile: string): boolean {
  // Regex for common secrets (sk-...)
  const secretPattern = /sk-[a-zA-Z0-9-]{16,}/;
  const match = content.match(secretPattern);

  if (match) {
    console.error(`[SECURITY FATAL] Secret pattern detected in ${sourceFile}`);
    return true;
  }
  return false;
}

export function redactSecrets(content: string): string {
  const secretPattern = /sk-[a-zA-Z0-9-]{16,}/g;
  return content.replace(secretPattern, '***REDACTED***');
}
