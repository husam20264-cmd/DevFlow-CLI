import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { diffLines, createTwoFilesPatch } from 'diff';

export class FileChanger {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.changes = [];
    this.backupDir = join(projectPath, '.devflow-backups');
  }

  async proposeChange(file, newContent, description = '') {
    const fullPath = join(this.projectPath, file);
    const existing = existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : null;

    const change = {
      file,
      fullPath,
      action: existing ? 'modify' : 'create',
      existingContent: existing,
      newContent,
      description,
      timestamp: new Date().toISOString()
    };

    if (existing) {
      change.diff = createTwoFilesPatch(file, file, existing, newContent, 'current', 'proposed');
      change.changes = diffLines(existing, newContent);
    }

    this.changes.push(change);
    return change;
  }

  async confirmChanges() {
    console.log('\n📝 Proposed Changes:\n');

    for (let i = 0; i < this.changes.length; i++) {
      const change = this.changes[i];
      const icon = change.action === 'create' ? '✨' : '✏️';
      console.log(`${icon} ${i + 1}. ${change.file}`);
      console.log(`   Action: ${change.action}`);
      if (change.description) console.log(`   Description: ${change.description}`);
      if (change.diff) {
        const additions = (change.diff.match(/^\+[^+]/gm) || []).length;
        const deletions = (change.diff.match(/^-[^-]/gm) || []).length;
        console.log(`   Changes: +${additions} -${deletions} lines`);
      }
      console.log('');
    }

    return this.changes;
  }

  async applyChanges(dryRun = false) {
    if (dryRun) {
      console.log('\n🔍 Dry run - no files will be modified\n');
      await this.confirmChanges();
      return { applied: 0, skipped: this.changes.length };
    }

    // Create backup directory
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }

    const results = [];

    for (const change of this.changes) {
      try {
        // Backup existing file
        if (change.existingContent) {
          const backupPath = join(this.backupDir, `${Date.now()}-${change.file.replace(/\//g, '_')}`);
          copyFileSync(change.fullPath, backupPath);
        }

        // Create directory if needed
        const dir = dirname(change.fullPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        // Write new content
        writeFileSync(change.fullPath, change.newContent);

        results.push({ file: change.file, success: true });
        console.log(`✅ ${change.action === 'create' ? 'Created' : 'Modified'}: ${change.file}`);
      } catch (error) {
        results.push({ file: change.file, success: false, error: error.message });
        console.log(`❌ Failed: ${change.file} - ${error.message}`);
      }
    }

    return {
      applied: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  async rollback() {
    if (!existsSync(this.backupDir)) {
      console.log('No backups found');
      return;
    }

    const { readdirSync } = await import('fs');
    const backups = readdirSync(this.backupDir).sort().reverse();

    for (const backup of backups) {
      const backupPath = join(this.backupDir, backup);
      const originalFile = backup.replace(/^\d+-/, '').replace(/_/g, '/');
      const originalPath = join(this.projectPath, originalFile);

      try {
        copyFileSync(backupPath, originalPath);
        console.log(`✅ Rolled back: ${originalFile}`);
      } catch (error) {
        console.log(`❌ Failed to rollback: ${originalFile}`);
      }
    }
  }

  getDiffSummary() {
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const change of this.changes) {
      if (change.changes) {
        for (const part of change.changes) {
          if (part.added) totalAdditions += part.count;
          if (part.removed) totalDeletions += part.count;
        }
      }
    }

    return {
      files: this.changes.length,
      additions: totalAdditions,
      deletions: totalDeletions
    };
  }
}
