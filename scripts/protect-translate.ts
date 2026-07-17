import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const sourceFile = args[0];
const engine = args[1] || 'ollama';

if (!sourceFile) {
  console.error('Usage: tsx protect-translate.ts <source-file> [engine]');
  process.exit(1);
}

const targetFile = sourceFile.replace(/\.md$/, '.pt-br.md');
const tmpSource = `${sourceFile}.tmp.source.md`;
const tmpTarget = `${sourceFile}.tmp.source.pt-br.md`;

try {
  let content = fs.readFileSync(sourceFile, 'utf-8');

  const tokens = new Map<string, string>();
  let tokenCounter = 1;

  const tokenize = (match: string) => {
    const token = `__PROTECTED_BLOCK_${String(tokenCounter++).padStart(4, '0')}__`;
    tokens.set(token, match);
    return token;
  };

  // Protect frontmatter
  content = content.replace(/^---\n[\s\S]*?\n---\n/, tokenize);

  // Protect fenced code blocks
  content = content.replace(/```[\s\S]*?```/g, tokenize);

  // Protect inline code
  content = content.replace(/`[^`\n]+`/g, tokenize);

  // Protect URLs in standard markdown links
  content = content.replace(
    /\]\(([^)]+)\)/g,
    (match, url) => `](${tokenize(url)})`,
  );

  // Protect image tags completely
  content = content.replace(/!\[.*?\]\(.*?\)/g, tokenize);

  // Write tokenized content to a temp file
  fs.writeFileSync(tmpSource, content);

  // Call Python translate script
  const scriptPath =
    'C:\\Users\\fjuni\\.gemini\\config\\skills\\translation\\scripts\\translate_doc.py';
  console.log(`Running translation via ${engine}...`);
  execSync(
    `python ${scriptPath} -f "${tmpSource}" -o "${tmpTarget}" -e ${engine}`,
    { stdio: 'inherit' },
  );

  if (!fs.existsSync(tmpTarget)) {
    throw new Error('Translation failed to produce output file.');
  }

  // Read back and restore tokens
  let translatedContent = fs.readFileSync(tmpTarget, 'utf-8');
  for (const [token, originalValue] of tokens.entries()) {
    translatedContent = translatedContent.split(token).join(originalValue);
  }

  const finalTmpFile = `${sourceFile}.tmp.pt-br.md`;
  fs.writeFileSync(finalTmpFile, translatedContent);

  // Atomic rename
  fs.renameSync(finalTmpFile, targetFile);

  // Cleanup tmp files
  if (fs.existsSync(tmpSource)) fs.unlinkSync(tmpSource);
  if (fs.existsSync(tmpTarget)) fs.unlinkSync(tmpTarget);

  console.log(`Successfully translated and restored: ${targetFile}`);
  process.exit(0);
} catch (error) {
  console.error('Translation Error:', error);
  process.exit(1);
}
