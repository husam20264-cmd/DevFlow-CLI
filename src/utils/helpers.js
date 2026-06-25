import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function loadConfig(projectPath) {
  const configPath = join(projectPath, 'devflow.config.json');
  if (!existsSync(configPath)) return getDefaultConfig();
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

export function getDefaultConfig() {
  return {
    provider: 'ollama',
    model: 'codellama:7b',
    testCommands: ['npm test', 'npx jest', 'python -m pytest'],
    lintCommands: ['npm run lint', 'npx eslint .'],
    excludePatterns: ['node_modules', '.git', 'dist', 'build'],
    autoFix: false,
    confirmChanges: true
  };
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function truncate(str, len = 100) {
  if (str.length <= len) return str;
  return str.substring(0, len - 3) + '...';
}

export function colorByStatus(status) {
  const colors = {
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.cyan
  };
  return colors[status] || chalk.white;
}
