import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ProjectAnalyzer } from '../src/core/project-analyzer.js';
import { TestRunner } from '../src/core/test-runner.js';
import { PRGenerator } from '../src/core/pr-generator.js';
import { CommandSafetyGuard } from '../src/core/safety-guard.js';
import { FileChanger } from '../src/core/file-changer.js';
import { DevFlowEngine } from '../src/core/engine.js';

const TEST_DIR = join(process.cwd(), '.test-project');

before(() => {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });

  // Create test project structure
  writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    scripts: { test: 'echo "tests passed"', lint: 'echo "lint passed"' }
  }, null, 2));

  writeFileSync(join(TEST_DIR, 'index.js'), 'console.log("hello");');
  writeFileSync(join(TEST_DIR, '.gitignore'), 'node_modules/\n.env');
  mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
  writeFileSync(join(TEST_DIR, 'src/app.js'), 'export const app = {};');
  mkdirSync(join(TEST_DIR, 'tests'), { recursive: true });
  writeFileSync(join(TEST_DIR, 'tests/app.test.js'), 'describe("app", () => {});');
});

after(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('Project Analyzer', () => {
  it('should detect project language', async () => {
    const analyzer = new ProjectAnalyzer(TEST_DIR);
    const result = await analyzer.analyze();
    assert.ok(result.summary.language);
    assert.notStrictEqual(result.summary.language, '');
  });

  it('should count files correctly', async () => {
    const analyzer = new ProjectAnalyzer(TEST_DIR);
    const result = await analyzer.analyze();
    assert.ok(result.summary.totalFiles >= 4);
  });

  it('should detect test files', async () => {
    const analyzer = new ProjectAnalyzer(TEST_DIR);
    const result = await analyzer.analyze();
    assert.ok(result.summary.testFiles >= 1);
  });

  it('should detect package.json', async () => {
    const analyzer = new ProjectAnalyzer(TEST_DIR);
    const result = await analyzer.analyze();
    assert.strictEqual(result.config.packageJson, true);
  });

  it('should read .gitignore', async () => {
    const analyzer = new ProjectAnalyzer(TEST_DIR);
    const result = await analyzer.analyze();
    assert.ok(result.gitignore.includes('node_modules/'));
  });

  it('should detect npm as package manager', async () => {
    const analyzer = new ProjectAnalyzer(TEST_DIR);
    const result = await analyzer.analyze();
    assert.strictEqual(result.packageManager, 'npm');
  });

  it('should get file content', async () => {
    const analyzer = new ProjectAnalyzer(TEST_DIR);
    await analyzer.analyze();
    const content = analyzer.getFileContent('index.js');
    assert.strictEqual(content, 'console.log("hello");');
  });

  it('should return null for non-existent file', async () => {
    const analyzer = new ProjectAnalyzer(TEST_DIR);
    await analyzer.analyze();
    const content = analyzer.getFileContent('nonexistent.js');
    assert.strictEqual(content, null);
  });
});

describe('Safety Guard', () => {
  it('should block path traversal', async () => {
    const guard = new CommandSafetyGuard(TEST_DIR);
    const safe = await guard.checkFilePath('../../etc/passwd');
    assert.strictEqual(safe, false);
    assert.ok(guard.blocked.length > 0);
  });

  it('should allow safe file paths', async () => {
    const guard = new CommandSafetyGuard(TEST_DIR);
    const safe = await guard.checkFilePath('src/app.js');
    assert.strictEqual(safe, true);
  });

  it('should detect hardcoded secrets', async () => {
    const guard = new CommandSafetyGuard(TEST_DIR);
    const warnings = await guard.checkFileContent('const apiKey = "sk-123456789012345678901234567890123456789012345678901234567890"');
    assert.ok(warnings.length > 0);
    assert.strictEqual(warnings[0].type, 'hardcoded_secret');
  });
});

describe('File Changer', () => {
  it('should propose changes', async () => {
    const changer = new FileChanger(TEST_DIR);
    const change = await changer.proposeChange('test-file.js', 'console.log("test");', 'Test file');
    assert.strictEqual(change.action, 'create');
    assert.strictEqual(change.newContent, 'console.log("test");');
  });

  it('should get diff summary', async () => {
    const changer = new FileChanger(TEST_DIR);
    await changer.proposeChange('test-file.js', 'line1\nline2\nline3', 'Test');
    const summary = changer.getDiffSummary();
    assert.ok(summary.files >= 1);
  });
});

describe('PR Generator', () => {
  it('should generate PR title', () => {
    const prGen = new PRGenerator(TEST_DIR);
    const plan = { request: 'Add authentication system' };
    const pr = prGen.generate(plan, { changes: [] }, null);
    assert.ok(pr.title.includes('Add authentication system'));
  });

  it('should sanitize branch names', () => {
    const prGen = new PRGenerator(TEST_DIR);
    const branch = prGen.sanitizeBranchName('Add JWT Auth! @#$%');
    assert.ok(/^[a-z0-9-]+$/.test(branch));
  });

  it('should generate PR body', () => {
    const prGen = new PRGenerator(TEST_DIR);
    const plan = {
      request: 'Add auth',
      explanation: 'Added authentication',
      plan: [{ step: 1, action: 'Create auth', files: ['auth.js'] }],
      risks: ['Breaking change']
    };
    const changes = {
      changes: [{ file: 'auth.js', action: 'create', description: 'Auth module' }]
    };
    const pr = prGen.generate(plan, changes, null);
    assert.ok(pr.body.includes('authentication'));
    assert.ok(pr.body.includes('auth.js'));
  });

  it('should save PR draft file', () => {
    const prGen = new PRGenerator(TEST_DIR);
    const plan = { request: 'Test PR', explanation: 'Test', plan: [], risks: [] };
    const changes = { changes: [] };
    const pr = prGen.generate(plan, changes, null);
    const path = prGen.savePRDraft(pr, 'TEST_PR.md');
    assert.ok(existsSync(path));
    const content = readFileSync(path, 'utf8');
    assert.ok(content.includes('Test PR'));
    rmSync(path);
  });
});

describe('Test Runner', () => {
  it('should detect test runner', async () => {
    const runner = new TestRunner(TEST_DIR);
    const result = await runner.runTests();
    assert.ok(result !== null);
  });

  it('should run npm test', async () => {
    const runner = new TestRunner(TEST_DIR);
    const result = await runner.run('npm test', { silent: true });
    assert.strictEqual(result.success, true);
  });
});

describe('DevFlow Engine', () => {
  it('should initialize', async () => {
    const engine = new DevFlowEngine(TEST_DIR);
    await engine.initialize();
    assert.ok(engine.context);
  });

  it('should understand project', async () => {
    const engine = new DevFlowEngine(TEST_DIR);
    await engine.initialize();
    const info = await engine.understandProject();
    assert.ok(info.summary);
    assert.ok(info.summary.language);
  });
});
