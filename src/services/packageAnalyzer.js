import JSZip from 'jszip';

const JAVA_SOURCE = /src\/main\/java\/.*\.java$/i;
const JAVA_TEST = /src\/test\/java\/.*(?:Test|Tests|IT)\.java$/i;
const CONTROLLER = /(@RestController|@Controller|Controller\b)/;
const SERVICE = /(@Service|Service\b)/;
const REPOSITORY = /(@Repository|Repository\b)/;
const ENTITY = /(@Entity|Entity\b)/;
const ENDPOINT = /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\s*(\([^)]*\))?/g;
const BDD_FILE = /\.(feature|story|spec|md|txt)$/i;

export async function analyzePackageFile(file) {
  if (!file) throw new Error('Package file is required.');
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const files = entries.map((entry) => entry.name);
  const javaFiles = entries.filter((entry) => JAVA_SOURCE.test(entry.name));
  const testFiles = entries.filter((entry) => JAVA_TEST.test(entry.name));
  const bddFiles = entries.filter((entry) => BDD_FILE.test(entry.name) && /bdd|feature|scenario|requirement|story|spec/i.test(entry.name));
  const pomFiles = files.filter((name) => /(^|\/)pom\.xml$/i.test(name));
  const buildFiles = files.filter((name) => /(^|\/)(pom\.xml|build\.gradle|build\.gradle\.kts)$/i.test(name));
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
  };
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
  annotations.forEach((type) => candidates.push(`${titleCase(type)} Layer`));
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
