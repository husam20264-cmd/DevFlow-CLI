#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import {
  setupCommand,
  planCommand,
  explainCommand,
  checkCommand,
  prCommand
} from '../src/commands/index.js';

const program = new Command();

program
  .name('devflow')
  .description('AI-powered CLI assistant for developers')
  .version('1.0.0');

program
  .command('plan <request>')
  .description('Analyze project and create an execution plan')
  .option('--apply', 'Apply changes (default: dry-run)')
  .option('--dry-run', 'Preview changes without applying (deprecated, use default)')
  .action(planCommand);

program
  .command('explain [errorFile]')
  .description('Explain an error and suggest fixes')
  .action(explainCommand);

program
  .command('check')
  .description('Run tests and lint checks')
  .action(checkCommand);

program
  .command('pr')
  .description('Generate a PR draft')
  .option('-d, --description <desc>', 'PR description')
  .option('--open', 'Open PR draft in editor')
  .action(prCommand);

program
  .command('setup')
  .description('Initialize DevFlow in current project')
  .action(setupCommand);

program.parse();
