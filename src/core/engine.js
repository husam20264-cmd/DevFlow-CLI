import { ProjectAnalyzer } from './project-analyzer.js';
import { LLMProviderManager } from '../providers/llm-manager.js';

export class DevFlowEngine {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.analyzer = new ProjectAnalyzer(projectPath);
    this.llm = new LLMProviderManager();
    this.context = null;
  }

  async initialize() {
    this.context = await this.analyzer.analyze();
    return this;
  }

  async understandProject() {
    if (!this.context) await this.initialize();

    const summary = this.context.summary;
    const keyFiles = this.context.files
      .filter(f => this.analyzer.isEntryPoint(f.path) || this.analyzer.isConfigFile(f.path))
      .slice(0, 10)
      .map(f => f.path);

    return {
      summary,
      keyFiles,
      structure: this.context.directories.slice(0, 20),
      config: this.context.config
    };
  }

  async createPlan(request) {
    if (!this.context) await this.initialize();

    const projectInfo = await this.understandProject();
    const prompt = `Based on this project structure, create a detailed execution plan for the following request.

Project Info:
- Language: ${projectInfo.summary.language}
- Package Manager: ${projectInfo.summary.packageManager}
- Files: ${projectInfo.summary.totalFiles}
- Entry Points: ${keyFiles.join(', ')}

Request: ${request}

Provide a step-by-step plan with specific files to create/modify and the changes needed.`;

    const plan = await this.llm.analyze(prompt, {
      projectStructure: JSON.stringify(projectInfo, null, 2)
    });

    return {
      ...plan,
      timestamp: new Date().toISOString(),
      request
    };
  }

  async suggestChanges(plan) {
    const changes = [];

    for (const step of plan.plan || []) {
      for (const file of step.files || []) {
        const existing = this.analyzer.getFileContent(file);
        changes.push({
          file,
          action: existing ? 'modify' : 'create',
          step: step.step,
          description: step.action,
          existingContent: existing,
          relatedFiles: this.analyzer.getRelatedFiles(file)
        });
      }
    }

    return {
      changes,
      summary: plan.explanation,
      risks: plan.risks || []
    };
  }

  async explainError(errorOutput, fileContext = null) {
    const prompt = `Analyze this error and provide:
1. A clear explanation of what went wrong
2. The root cause
3. Specific fix suggestions with code examples

Error Output:
${errorOutput}

${fileContext ? `File Context:\n${fileContext}` : ''}

Respond in JSON format:
{
  "explanation": "clear explanation",
  "cause": "root cause",
  "fixes": [{"description": "fix description", "code": "code snippet", "file": "file path"}]
}`;

    return this.llm.analyze(prompt, { errors: errorOutput });
  }

  async generatePRDraft(changes, plan) {
    const title = this.generateCommitTitle(plan);
    const body = this.generatePRBody(changes, plan);
    const filesChanged = changes.changes.map(c => ({
      file: c.file,
      action: c.action,
      description: c.description
    }));

    return {
      title,
      body,
      filesChanged,
      branch: this.sanitizeBranchName(plan.request),
      checklist: this.generateChecklist(changes)
    };
  }

  generateCommitTitle(plan) {
    const short = (plan.request || 'update').substring(0, 50);
    return `feat: ${short}`;
  }

  generatePRBody(changes, plan) {
    const lines = [
      '## Summary',
      changes.summary || 'No summary available',
      '',
      '## Changes',
      ...changes.changes.map(c => `- ${c.action === 'create' ? '✨ Created' : '✏️ Modified'} \`${c.file}\`: ${c.description}`),
      '',
      '## Risks',
      ...(changes.risks || []).map(r => `- ⚠️ ${r}`),
      '',
      '## Checklist',
      '- [ ] Tests pass',
      '- [ ] Lint passes',
      '- [ ] Documentation updated',
      '- [ ] No breaking changes'
    ];
    return lines.join('\n');
  }

  sanitizeBranchName(name) {
    return (name || 'devflow-update')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  generateChecklist(changes) {
    return [
      { item: 'Run tests', command: 'npm test' },
      { item: 'Run linter', command: 'npm run lint' },
      { item: 'Type check', command: 'npx tsc --noEmit' },
      { item: 'Build', command: 'npm run build' }
    ];
  }
}
