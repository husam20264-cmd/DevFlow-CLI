import { existsSync, readFileSync } from 'fs';
import { join, resolve, relative } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';

const DANGEROUS_COMMANDS = [
  'rm -rf', 'rm -r', 'sudo', 'git push --force', 'git push -f',
  'chmod 777', 'chown', 'kill', 'killall', 'shutdown', 'reboot',
  'mkfs', 'dd', 'format', 'fdisk'
];

const SENSITIVE_FILES = [
  '.env', '.env.local', '.env.production', '.env.development',
  '.aws/credentials', '.ssh/id_rsa', '.ssh/id_ed25519',
  'credentials.json', 'service-account.json', '.npmrc',
  'docker-compose.override.yml'
];

const SENSITIVE_PATTERNS = [
  /password/i, /secret/i, /token/i, /api.?key/i,
  /private.?key/i, /credential/i, /auth.?token/i
];

const NETWORK_COMMANDS = [
  'curl', 'wget', 'fetch', 'http', 'https',
  'ssh', 'scp', 'rsync', 'nc', 'netcat'
];

const PACKAGE_COMMANDS = [
  'npm install', 'npm i', 'yarn add', 'pnpm add',
  'pip install', 'cargo install', 'go install',
  'apt install', 'apt-get install', 'brew install'
];

export class CommandSafetyGuard {
  constructor(projectPath) {
    this.projectPath = resolve(projectPath);
    this.warnings = [];
    this.blocked = [];
  }

  async checkFilePath(filePath) {
    const fullPath = resolve(this.projectPath, filePath);
    const relativePath = relative(this.projectPath, fullPath);

    // Block path traversal
    if (relativePath.startsWith('..') || fullPath.startsWith('..')) {
      this.blocked.push({
        type: 'path_traversal',
        path: filePath,
        message: 'Path traversal detected - cannot access files outside project'
      });
      return false;
    }

    // Check sensitive files
    for (const sensitive of SENSITIVE_FILES) {
      if (relativePath === sensitive || relativePath.endsWith('/' + sensitive)) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: chalk.yellow(`⚠️  This modifies a sensitive file: ${sensitive}. Continue?`),
          default: false
        }]);
        if (!confirm) return false;
      }
    }

    // Check sensitive patterns
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(relativePath)) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: chalk.yellow(`⚠️  File matches sensitive pattern: ${relativePath}. Continue?`),
          default: false
        }]);
        if (!confirm) return false;
      }
    }

    return true;
  }

  async checkCommand(command) {
    const cmd = command.toLowerCase().trim();

    // Check dangerous commands
    for (const dangerous of DANGEROUS_COMMANDS) {
      if (cmd.includes(dangerous)) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: chalk.red(`🚫 Dangerous command detected: "${dangerous}". Execute "${command}"?`),
          default: false
        }]);
        if (!confirm) {
          this.blocked.push({
            type: 'dangerous_command',
            command,
            message: `Blocked dangerous command: ${dangerous}`
          });
          return false;
        }
      }
    }

    // Check network commands
    for (const network of NETWORK_COMMANDS) {
      if (cmd.startsWith(network + ' ') || cmd.startsWith(network + '\t')) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: chalk.yellow(`🌐 Network command detected: "${network}". Execute?`),
          default: false
        }]);
        if (!confirm) return false;
      }
    }

    // Check package installation
    for (const pkg of PACKAGE_COMMANDS) {
      if (cmd.startsWith(pkg)) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: chalk.yellow(`📦 Package installation detected. Execute "${command}"?`),
          default: false
        }]);
        if (!confirm) return false;
      }
    }

    return true;
  }

  async checkFileContent(content) {
    const warnings = [];

    // Check for hardcoded secrets
    const secretPatterns = [
      { pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"][^'"]+['"]/i, type: 'API Key' },
      { pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]+['"]/i, type: 'Password' },
      { pattern: /(?:secret|token)\s*[=:]\s*['"][^'"]+['"]/i, type: 'Secret/Token' },
      { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, type: 'Private Key' },
      { pattern: /ghp_[a-zA-Z0-9]{36}/, type: 'GitHub Token' },
      { pattern: /sk-[a-zA-Z0-9]{48}/, type: 'OpenAI API Key' },
      { pattern: /xoxb-[a-zA-Z0-9-]+/, type: 'Slack Token' }
    ];

    for (const { pattern, type } of secretPatterns) {
      if (pattern.test(content)) {
        warnings.push({
          type: 'hardcoded_secret',
          secretType: type,
          message: `Possible hardcoded ${type} detected`
        });
      }
    }

    this.warnings.push(...warnings);
    return warnings;
  }

  async confirmDryRun(changes) {
    console.log(chalk.bold('\n📋 Dry Run Preview:\n'));

    for (const change of changes) {
      const icon = change.action === 'create' ? '✨' : '✏️';
      console.log(`${icon} ${chalk.bold(change.file)}`);
      if (change.description) console.log(`   ${change.description}`);
      if (change.diff) {
        console.log(chalk.dim('   ---'));
        console.log(change.diff.split('\n').slice(0, 20).join('\n'));
        if (change.diff.split('\n').length > 20) {
          console.log(chalk.dim('   ... (truncated)'));
        }
        console.log(chalk.dim('   ---'));
      }
      console.log('');
    }

    const { apply } = await inquirer.prompt([{
      type: 'confirm',
      name: 'apply',
      message: chalk.green('Apply these changes?'),
      default: false
    }]);

    return apply;
  }

  getReport() {
    return {
      blocked: this.blocked,
      warnings: this.warnings,
      safe: this.blocked.length === 0
    };
  }
}
