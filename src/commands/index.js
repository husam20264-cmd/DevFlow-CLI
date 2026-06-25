import { DevFlowEngine } from '../core/engine.js';
import { TestRunner } from '../core/test-runner.js';
import { FileChanger } from '../core/file-changer.js';
import { PRGenerator } from '../core/pr-generator.js';
import { CommandSafetyGuard } from '../core/safety-guard.js';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';

export async function setupCommand(options) {
  const spinner = ora('Initializing DevFlow...').start();

  try {
    const engine = new DevFlowEngine(process.cwd());
    await engine.initialize();

    console.log(chalk.green('\n✅ DevFlow initialized successfully!\n'));

    const projectInfo = await engine.understandProject();

    console.log(chalk.bold('📊 Project Analysis:'));
    console.log(`  Language: ${chalk.cyan(projectInfo.summary.language)}`);
    console.log(`  Files: ${chalk.cyan(projectInfo.summary.totalFiles)}`);
    console.log(`  Package Manager: ${chalk.cyan(projectInfo.summary.packageManager)}`);
    console.log(`  Test Files: ${chalk.cyan(projectInfo.summary.testFiles)}`);

    spinner.stop();
  } catch (error) {
    spinner.fail(error.message);
    process.exit(1);
  }
}

export async function planCommand(request, options) {
  const spinner = ora('Analyzing project and creating plan...').start();

  try {
    const engine = new DevFlowEngine(process.cwd());
    await engine.initialize();

    spinner.text = 'Generating execution plan...';
    const plan = await engine.createPlan(request);

    spinner.succeed('Plan created!\n');

    console.log(chalk.bold('📋 Execution Plan:'));
    console.log(chalk.dim(`Request: ${plan.request}\n`));

    for (const step of plan.plan || []) {
      console.log(chalk.bold(`Step ${step.step}:`));
      console.log(`  ${step.action}`);
      if (step.files && step.files.length > 0) {
        console.log(`  Files: ${chalk.cyan(step.files.join(', '))}`);
      }
      console.log('');
    }

    if (plan.explanation) {
      console.log(chalk.bold('💡 Explanation:'));
      console.log(`  ${plan.explanation}\n`);
    }

    if (plan.risks && plan.risks.length > 0) {
      console.log(chalk.bold('⚠️ Risks:'));
      for (const risk of plan.risks) {
        console.log(`  - ${risk}`);
      }
      console.log('');
    }

    // Check if --apply is set, otherwise default to dry-run
    if (!options.apply) {
      console.log(chalk.yellow('🔒 Dry-run mode (default). Use --apply to make changes.\n'));

      const changes = await engine.suggestChanges(plan);
      const fileChanger = new FileChanger(process.cwd());
      const safetyGuard = new CommandSafetyGuard(process.cwd());

      for (const change of changes.changes) {
        const content = change.existingContent || `// New file: ${change.file}\n`;
        const safe = await safetyGuard.checkFilePath(change.file);
        if (safe) {
          await fileChanger.proposeChange(change.file, content, change.description);
        }
      }

      const report = safetyGuard.getReport();
      if (report.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️ Warnings:'));
        for (const w of report.warnings) {
          console.log(`  - ${w.message}`);
        }
      }

      const apply = await fileChanger.confirmChanges();
      if (apply) {
        await fileChanger.applyChanges(false);
        console.log(chalk.green('\n✅ Changes applied successfully!'));
      } else {
        console.log(chalk.dim('\n📝 Changes not applied.'));
      }
    } else {
      console.log(chalk.green('🔓 Apply mode enabled.\n'));
      const changes = await engine.suggestChanges(plan);
      const fileChanger = new FileChanger(process.cwd());
      const safetyGuard = new CommandSafetyGuard(process.cwd());

      for (const change of changes.changes) {
        const content = change.existingContent || `// New file: ${change.file}\n`;
        const safe = await safetyGuard.checkFilePath(change.file);
        if (safe) {
          await fileChanger.proposeChange(change.file, content, change.description);
        }
      }

      await fileChanger.applyChanges(false);
      console.log(chalk.green('\n✅ Changes applied successfully!'));
    }

    // Generate PR draft
    const changes = await engine.suggestChanges(plan);
    const prGen = new PRGenerator(process.cwd());
    const prData = prGen.generate(plan, changes, null);
    const prPath = prGen.savePRDraft(prData);

    console.log(chalk.green(`\n📄 PR Draft saved to: ${prPath}`));

  } catch (error) {
    spinner.fail(error.message);
    process.exit(1);
  }
}

export async function explainCommand(errorFile, options) {
  const spinner = ora('Analyzing error...').start();

  try {
    const engine = new DevFlowEngine(process.cwd());
    await engine.initialize();

    let errorOutput;
    if (errorFile) {
      const { readFileSync } = await import('fs');
      errorOutput = readFileSync(errorFile, 'utf8');
    } else {
      // Read from stdin
      errorOutput = await new Promise((resolve) => {
        let data = '';
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => resolve(data));
      });
    }

    spinner.text = 'Generating explanation...';
    const explanation = await engine.explainError(errorOutput);

    spinner.succeed('Analysis complete!\n');

    console.log(chalk.bold('🔍 Error Explanation:'));
    console.log(`  ${explanation.explanation}\n`);

    console.log(chalk.bold('📌 Root Cause:'));
    console.log(`  ${explanation.cause}\n`);

    if (explanation.fixes && explanation.fixes.length > 0) {
      console.log(chalk.bold('🔧 Suggested Fixes:'));
      for (const fix of explanation.fixes) {
        console.log(`\n  ${chalk.cyan(fix.description)}`);
        if (fix.file) console.log(`  File: ${fix.file}`);
        if (fix.code) {
          console.log(chalk.dim('  ---'));
          console.log(`  ${fix.code}`);
          console.log(chalk.dim('  ---'));
        }
      }
    }
  } catch (error) {
    spinner.fail(error.message);
    process.exit(1);
  }
}

export async function checkCommand(options) {
  const runner = new TestRunner(process.cwd());
  const results = await runner.runAll();

  console.log(chalk.bold('\n📊 Summary:'));
  console.log(`  Total: ${results.summary.total}`);
  console.log(`  Passed: ${chalk.green(results.summary.passed)}`);
  console.log(`  Failed: ${chalk.red(results.summary.failed)}`);

  process.exit(results.allPassed ? 0 : 1);
}

export async function prCommand(options) {
  const spinner = ora('Generating PR draft...').start();

  try {
    const engine = new DevFlowEngine(process.cwd());
    await engine.initialize();

    const plan = await engine.createPlan(options.description || 'Update project');
    const changes = await engine.suggestChanges(plan);

    const runner = new TestRunner(process.cwd());
    const testResults = await runner.runAll();

    const prGen = new PRGenerator(process.cwd());
    const prData = prGen.generate(plan, changes, testResults);
    const prPath = prGen.savePRDraft(prData);

    spinner.succeed('PR Draft generated!\n');

    console.log(chalk.bold('📄 PR Draft:'));
    console.log(`  Title: ${prData.title}`);
    console.log(`  Branch: ${chalk.cyan(prData.branch)}`);
    console.log(`  Files Changed: ${prData.filesChanged.length}`);
    console.log(`  Saved to: ${chalk.cyan(prPath)}`);

    if (options.open) {
      const { exec } = await import('child_process');
      exec(`code ${prPath}`);
    }
  } catch (error) {
    spinner.fail(error.message);
    process.exit(1);
  }
}
