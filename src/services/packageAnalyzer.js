import JSZip from 'jszip';

const JAVA_SOURCE = /src\/main\/java\/.*\.java$/i;
const JAVA_TEST = /src\/test\/java\/.*(?:Test|Tests|IT)\.java$/i;
const CONTROLLER = /(@RestController|@Controller|Controller\b)/;
const SERVICE = /(@Service|Service\b)/;
const REPOSITORY = /(@Repository|Repository\b)/;
const ENTITY = /(@Entity|Entity\b)/;
const ENDPOINT = /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\s*(\([^)]*\))?/g;
const BDD_FILE = /\.(feature|story|spec|md|txt)$/i;
const CONFIG_FILE = /src\/main\/resources\/.*\.(properties|ya?ml)$/i;
const BUILD_FILE = /(^|\/)(pom\.xml|build\.gradle|build\.gradle\.kts)$/i;
const MAX_SOURCE_FILES = 90;
const MAX_SOURCE_CHARS = 12000;
const MAX_TOTAL_SOURCE_CHARS = 220000;

export async function analyzePackageFile(file) {
  if (!file) throw new Error('Package file is required.');
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const files = entries.map((entry) => entry.name);
  const javaFiles = entries.filter((entry) => JAVA_SOURCE.test(entry.name));
  const testFiles = entries.filter((entry) => JAVA_TEST.test(entry.name));
  const bddFiles = entries.filter((entry) => BDD_FILE.test(entry.name) && /bdd|feature|scenario|requirement|story|spec/i.test(entry.name));
  const pomFiles = files.filter((name) => /(^|\/)pom\.xml$/i.test(name));
  const buildFiles = files.filter((name) => BUILD_FILE.test(name));
  const frontendFiles = files.filter((name) => /(^|\/)(package\.json|frontend-journey|selenium|playwright|cypress)/i.test(name));

  const moduleSignals = [];
  const endpointSignals = [];
  const classSignals = [];

  for (const entry of javaFiles.slice(0, 220)) {
    const content = await entry.async('string');
    const className = entry.name.split('/').pop()?.replace(/\.java$/i, '') || entry.name;
    const packageMatch = content.match(/^\s*package\s+([^;]+);/m);
    const annotations = [
      CONTROLLER.test(content) ? 'controller' : '',
      SERVICE.test(content) ? 'service' : '',
      REPOSITORY.test(content) ? 'repository' : '',
      ENTITY.test(content) ? 'entity' : '',
    ].filter(Boolean);
    const methods = extractMethodNames(content);
    const endpoints = extractEndpoints(content);

    classSignals.push({
      path: entry.name,
      className,
      packageName: packageMatch?.[1] || '',
      annotations,
      methodCount: methods.length,
      methods: methods.slice(0, 18),
      endpoints,
    });

    endpoints.forEach((endpoint) => endpointSignals.push({ ...endpoint, className, path: entry.name }));
    inferModuleFromPath(entry.name, className, annotations).forEach((module) => {
      if (!moduleSignals.includes(module)) moduleSignals.push(module);
    });
  }

  const sourceFiles = await collectSourceEvidence(entries, classSignals);

  return {
    fileName: file.name,
    sizeBytes: file.size,
    projectName: inferProjectName(files, file.name),
    platform: inferPlatform(files),
    buildTool: buildFiles.some((name) => /pom\.xml$/i.test(name)) ? 'Maven' : buildFiles.length ? 'Gradle' : 'Unknown',
    hasSpringBoot: files.some((name) => /pom\.xml$/i.test(name)) && classSignals.some((item) => item.annotations.includes('controller')),
    sourceFileCount: javaFiles.length,
    testFileCount: testFiles.length,
    bddFileCount: bddFiles.length,
    frontendSignalCount: frontendFiles.length,
    pomFiles,
    bddFiles: bddFiles.map((entry) => entry.name).slice(0, 40),
    modules: moduleSignals.slice(0, 24),
    endpoints: endpointSignals.slice(0, 80),
    classes: classSignals.slice(0, 120),
    sourceFiles,
  };
}

async function collectSourceEvidence(entries, classSignals) {
  const ranked = entries
    .filter((entry) => isRelevantSourceFile(entry.name))
    .map((entry) => ({ entry, score: sourceRelevanceScore(entry.name, classSignals) }))
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, MAX_SOURCE_FILES);

  const evidence = [];
  let totalChars = 0;
  for (const { entry, score } of ranked) {
    if (totalChars >= MAX_TOTAL_SOURCE_CHARS) break;
    const raw = await entry.async('string');
    const content = sanitizeSourceContent(raw).slice(0, Math.min(MAX_SOURCE_CHARS, MAX_TOTAL_SOURCE_CHARS - totalChars));
    if (!content.trim()) continue;
    totalChars += content.length;
    evidence.push({
      path: entry.name,
      type: inferSourceType(entry.name, content),
      score,
      truncated: raw.length > content.length,
      charCount: raw.length,
      content,
    });
  }
  return evidence;
}

function isRelevantSourceFile(path) {
  if (/(^|\/)(target|build|node_modules|dist|coverage|\.git|\.idea|\.vscode)\//i.test(path)) return false;
  if (JAVA_SOURCE.test(path) || JAVA_TEST.test(path) || CONFIG_FILE.test(path) || BUILD_FILE.test(path)) return true;
  return BDD_FILE.test(path) && /bdd|feature|scenario|requirement|story|spec|brd/i.test(path);
}

function sourceRelevanceScore(path, classSignals) {
  let score = 0;
  if (BUILD_FILE.test(path)) score += 90;
  if (CONFIG_FILE.test(path)) score += 70;
  if (JAVA_SOURCE.test(path)) score += 50;
  if (JAVA_TEST.test(path)) score += 25;
  if (BDD_FILE.test(path)) score += 65;
  if (/controller|resource|endpoint/i.test(path)) score += 45;
  if (/service|manager|facade|usecase/i.test(path)) score += 40;
  if (/entity|model|dto|request|response/i.test(path)) score += 30;
  if (/security|auth|config|validation|exception/i.test(path)) score += 35;
  const signal = classSignals.find((item) => item.path === path);
  if (signal?.endpoints?.length) score += 35;
  if (signal?.annotations?.includes('controller')) score += 30;
  if (signal?.annotations?.includes('service')) score += 25;
  if (signal?.annotations?.includes('entity')) score += 20;
  return score;
}

function sanitizeSourceContent(content) {
  return String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{4,}/g, '\n\n\n');
}

function inferSourceType(path, content) {
  if (BUILD_FILE.test(path)) return 'Build';
  if (CONFIG_FILE.test(path)) return 'Config';
  if (BDD_FILE.test(path)) return 'Requirement';
  if (JAVA_TEST.test(path)) return 'Test';
  if (CONTROLLER.test(content)) return 'Controller';
  if (SERVICE.test(content)) return 'Service';
  if (REPOSITORY.test(content)) return 'Repository';
  if (ENTITY.test(content)) return 'Entity';
  return 'Java';
}

function extractMethodNames(content) {
  const matches = [...content.matchAll(/(?:public|protected|private)\s+(?:static\s+)?[\w<>\[\], ?]+\s+(\w+)\s*\([^)]*\)\s*(?:throws [^{]+)?\{/g)];
  return matches.map((match) => match[1]).filter((name) => !['if', 'for', 'while', 'switch'].includes(name));
}

function extractEndpoints(content) {
  const endpoints = [];
  for (const match of content.matchAll(ENDPOINT)) {
    const mapping = match[1];
    const args = match[2] || '';
    const path = args.match(/["']([^"']+)["']/)?.[1] || '';
    endpoints.push({ method: mapping.replace('Mapping', '').toUpperCase() || 'REQUEST', path });
  }
  return endpoints;
}

function inferModuleFromPath(path, className, annotations) {
  const clean = path.toLowerCase();
  const parts = clean.split('/').filter(Boolean);
  const candidates = [];
  const markerIndex = parts.findIndex((part) => part === 'java');
  if (markerIndex >= 0) {
    const packageParts = parts.slice(markerIndex + 1, -1);
    const meaningful = packageParts.filter((part) => !['com', 'org', 'net', 'io', 'app', 'application', 'src', 'main'].includes(part));
    if (meaningful.length) candidates.push(titleCase(meaningful[meaningful.length - 1]));
  }
  if (/auth|login|user|account/i.test(className)) candidates.push('Identity and Access');
  if (/book|library|borrow|return/i.test(className)) candidates.push('Library Management');
  if (/calc|operation|arithmetic/i.test(className)) candidates.push('Calculator Operations');
  return [...new Set(candidates)];
}

function inferProjectName(files, fallback) {
  const pom = files.find((name) => /(^|\/)pom\.xml$/i.test(name));
  if (pom) {
    const root = pom.split('/')[0];
    if (root && root !== 'pom.xml') return root;
  }
  return String(fallback || 'Java Application').replace(/\.(zip|jar)$/i, '');
}

function inferPlatform(files) {
  if (files.some((name) => /pom\.xml$/i.test(name))) return 'Java / Maven';
  if (files.some((name) => /build\.gradle/i.test(name))) return 'Java / Gradle';
  return 'Java';
}

function titleCase(value) {
  return String(value || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
