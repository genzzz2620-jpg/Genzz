const fs = require('node:fs');
const path = require('node:path');

const root = path.join(process.cwd(), 'app', 'api');
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'route.ts') files.push(full);
  }
}
walk(root);

for (const file of files) {
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/type RouteContext\s*=\s*\{\s*params:\s*\{([^}]+)\}\s*\};/g, 'type RouteContext = { params: Promise<{$1}> };');
  source = source.replace(/(\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*)\{([^{}]+)\}(\s*\})/g, '$1Promise<{$2}>$3');

  const contextMatch = source.match(/type RouteContext\s*=\s*\{\s*params:\s*Promise<\{([^}]+)\}>\s*\};/);
  const contextKeys = contextMatch ? [...contextMatch[1].matchAll(/(\w+)\s*:/g)].map((match) => match[1]) : [];
  const insertions = [];
  const signaturePattern = /export\s+async\s+function\s+\w+\([\s\S]*?\)\s*\{/g;
  for (const match of source.matchAll(signaturePattern)) {
    if (!/\{\s*params\s*\}/.test(match[0])) continue;
    const inline = match[0].match(/params\s*:\s*Promise<\{([^}]+)\}>/);
    const keys = inline ? [...inline[1].matchAll(/(\w+)\s*:/g)].map((item) => item[1]) : contextKeys;
    if (!keys.length) throw new Error(`Cannot infer params for ${file}`);
    insertions.push({ index: match.index + match[0].length, code: `\n  const { ${keys.join(', ')} } = await params;` });
  }
  for (const { index, code } of insertions.reverse()) source = source.slice(0, index) + code + source.slice(index);
  if (insertions.length) {
    for (const key of contextKeys) source = source.replace(new RegExp(`params\\.${key}\\b`, 'g'), key);
    for (const fileMatch of source.matchAll(/params\s*:\s*Promise<\{([^}]+)\}>/g)) {
      for (const item of fileMatch[1].matchAll(/(\w+)\s*:/g)) source = source.replace(new RegExp(`params\\.${item[1]}\\b`, 'g'), item[1]);
    }
    fs.writeFileSync(file, source);
  }
}

console.log(`Migrated async route params in ${files.length} route files.`);
