import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class TestRunner {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.results = [];
  }

  async run(command, options = {}) {
    const { timeout = 60000, silent = false } = options;

    if (!silent) console.log(`\n🔄 Running: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectPath,
        timeout,
        maxBuffer: 1024 * 1024 * 10
      });

      const result = {
        command,
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timestamp: new Date().toISOString()
      };

      this.results.push(result);
      if (!silent) console.log(`✅ Passed`);
      return result;
    } catch (error) {
      const result = {
        command,
        success: false,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message,
        timestamp: new Date().toISOString()
      };

      this.results.push(result);
      if (!silent) console.log(`❌ Failed`);
      return result;
    }
  }

  async runTests() {
    const commands = [
      { cmd: 'npm test', name: 'npm test' },
      { cmd: 'npx jest', name: 'Jest' },
      { cmd: 'npx vitest run', name: 'Vitest' },
      { cmd: 'python -m pytest', name: 'pytest' },
      { cmd: 'cargo test', name: 'cargo test' }
    ];

    for (const { cmd, name } of commands) {
      try {
        const result = await this.run(cmd, { silent: true });
        if (result.success) {
          console.log(`✅ ${name} passed`);
          return result;
        }
      } catch {}
    }

    console.log('⚠️ No test runner found or all tests failed');
    return null;
  }

  async runLint() {
    const commands = [
      'npm run lint',
      'npx eslint .',
      'npx prettier --check .',
      'ruff check .',
      'cargo clippy'
    ];

    for (const cmd of commands) {
      try {
        const result = await this.run(cmd, { silent: true });
        if (result.success) {
          console.log(`✅ Lint passed: ${cmd}`);
          return result;
        }
      } catch {}
    }

    console.log('⚠️ No linter found or lint failed');
    return null;
  }

  async runAll() {
    console.log('\n📋 Running all checks...\n');

    const testResult = await this.runTests();
    const lintResult = await this.runLint();

    return {
      tests: testResult,
      lint: lintResult,
      allPassed: testResult?.success && lintResult?.success,
      summary: this.generateSummary()
    };
  }

  generateSummary() {
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    return { total: this.results.length, passed, failed };
  }
}
