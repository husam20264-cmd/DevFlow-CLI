import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { glob } from 'glob';

export class ProjectAnalyzer {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.structure = null;
  }

  async analyze() {
    const structure = {
      root: this.rootPath,
      files: [],
      directories: [],
      config: {},
      language: 'unknown',
      packageManager: 'npm',
      gitignore: [],
      entryPoints: [],
      testFiles: [],
      configFiles: []
    };

    const allFiles = await glob('**/*', {
      cwd: this.rootPath,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '*.min.js'],
      nodir: true
    });

    for (const file of allFiles) {
      const fullPath = join(this.rootPath, file);
      const stat = statSync(fullPath);
      const info = {
        path: file,
        fullPath,
        size: stat.size,
        modified: stat.mtime,
        extension: file.includes('.') ? file.split('.').pop() : ''
      };

      structure.files.push(info);

      if (this.isTestFile(file)) structure.testFiles.push(info);
      if (this.isConfigFile(file)) structure.configFiles.push(info);
      if (this.isEntryPoint(file)) structure.entryPoints.push(info);
    }

    structure.directories = await this.getDirectories();
    structure.config = await this.detectConfig();
    structure.language = await this.detectLanguage();
    structure.packageManager = await this.detectPackageManager();
    structure.gitignore = await this.readGitignore();
    structure.summary = this.generateSummary(structure);

    this.structure = structure;
    return structure;
  }

  async detectConfig() {
    const configs = {
      packageJson: existsSync(join(this.rootPath, 'package.json')),
      tsConfig: existsSync(join(this.rootPath, 'tsconfig.json')),
      pyproject: existsSync(join(this.rootPath, 'pyproject.toml')),
      cargo: existsSync(join(this.rootPath, 'Cargo.toml')),
      goMod: existsSync(join(this.rootPath, 'go.mod')),
      docker: existsSync(join(this.rootPath, 'Dockerfile')),
      dockerCompose: existsSync(join(this.rootPath, 'docker-compose.yml')),
      eslint: existsSync(join(this.rootPath, '.eslintrc.js')) || existsSync(join(this.rootPath, '.eslintrc.json')),
      prettier: existsSync(join(this.rootPath, '.prettierrc')),
      git: existsSync(join(this.rootPath, '.git'))
    };

    if (configs.packageJson) {
      const pkg = JSON.parse(readFileSync(join(this.rootPath, 'package.json'), 'utf8'));
      configs.scripts = pkg.scripts || {};
      configs.dependencies = Object.keys(pkg.dependencies || {});
      configs.devDependencies = Object.keys(pkg.devDependencies || {});
    }

    return configs;
  }

  async detectLanguage() {
    const extensions = {};
    for (const file of (this.structure?.files || [])) {
      const ext = file.extension;
      if (ext) extensions[ext] = (extensions[ext] || 0) + 1;
    }

    const sorted = Object.entries(extensions).sort((a, b) => b[1] - a[1]);
    const langMap = {
      'js': 'javascript', 'ts': 'typescript', 'py': 'python',
      'rs': 'rust', 'go': 'go', 'java': 'java', 'cpp': 'cpp',
      'c': 'c', 'rb': 'ruby', 'php': 'php'
    };

    return sorted.length > 0 ? (langMap[sorted[0][0]] || sorted[0][0]) : 'unknown';
  }

  async detectPackageManager() {
    if (existsSync(join(this.rootPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (existsSync(join(this.rootPath, 'yarn.lock'))) return 'yarn';
    if (existsSync(join(this.rootPath, 'package-lock.json'))) return 'npm';
    if (existsSync(join(this.rootPath, 'Pipfile.lock'))) return 'pipenv';
    if (existsSync(join(this.rootPath, 'poetry.lock'))) return 'poetry';
    if (existsSync(join(this.rootPath, 'Cargo.lock'))) return 'cargo';
    return 'npm';
  }

  async readGitignore() {
    const gitignorePath = join(this.rootPath, '.gitignore');
    if (!existsSync(gitignorePath)) return [];
    return readFileSync(gitignorePath, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
  }

  async getDirectories() {
    const dirs = await glob('**/', {
      cwd: this.rootPath,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
    });
    return dirs.map(d => d.replace(/\/$/, ''));
  }

  isTestFile(file) {
    const testPatterns = ['test', 'spec', '__tests__', '.test.', '.spec.'];
    return testPatterns.some(p => file.toLowerCase().includes(p));
  }

  isConfigFile(file) {
    const configPatterns = ['config', '.rc', '.json', '.yaml', '.yml', '.toml', '.env'];
    return configPatterns.some(p => file.toLowerCase().includes(p));
  }

  isEntryPoint(file) {
    const entryPatterns = ['index.', 'main.', 'app.', 'server.', 'cli.'];
    return entryPatterns.some(p => file.endsWith(p) || file.includes(p));
  }

  generateSummary(structure) {
    return {
      totalFiles: structure.files.length,
      totalDirectories: structure.directories.length,
      language: structure.language,
      packageManager: structure.packageManager,
      config: structure.config,
      entryPoints: structure.entryPoints.length,
      testFiles: structure.testFiles.length,
      configFiles: structure.configFiles.length
    };
  }

  getFileContent(relativePath) {
    const fullPath = join(this.rootPath, relativePath);
    if (!existsSync(fullPath)) return null;
    return readFileSync(fullPath, 'utf8');
  }

  getRelatedFiles(filePath, context = 3) {
    const related = [];
    const dir = dirname(filePath);
    const base = filePath.split('/').pop().split('.')[0];

    for (const file of this.structure.files) {
      if (file.path === filePath) continue;
      if (file.path.startsWith(dir)) {
        if (file.path.includes(base) || dir === dirname(file.path)) {
          related.push(file.path);
        }
      }
    }

    return related.slice(0, context);
  }
}
