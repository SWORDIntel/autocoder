import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import CodeAnalyzer from './codeAnalyzer.js';
import CodeGenerator from './codeGenerator.js';
import FileManager from './fileManager.js';

const execAsync = promisify(exec);

class SelfImprovementAgent {
    constructor() {
        // The agent will attempt to improve its own source files.
        this.sourceFiles = [
            'fileManager.js',
            'codeGenerator.js',
            'codeAnalyzer.js',
            'tui.js',
            'index.js',
            'selfImprovementAgent.js'
        ];
    }

    async run() {
        const spinner = ora('Starting self-improvement cycle...').start();
        try {
            const projectStructure = await FileManager.getProjectStructure();

            for (const file of this.sourceFiles) {
                spinner.text = `Analyzing ${file} for improvements...`;
                const { analysis, fileContent } = await CodeAnalyzer.analyzeCodeQuality(file);

                spinner.text = `Proposing improvements for ${file}...`;
                const prompt = `Based on the following analysis, please generate an improved, complete version of the file \`${file}\`.
                The new version should incorporate the suggested improvements while maintaining all existing functionality.
                Only output the raw, complete code for the file, with no explanations, comments, or markdown.

                Analysis:
                ${analysis}

                Original file content:
                ${fileContent}
                `;

                const proposedCode = await CodeGenerator.generate(
                    'Improve the file based on the provided analysis.', // Simplified README for this context
                    fileContent,
                    file,
                    projectStructure,
                    {} // No other file contents for now to keep it focused
                );

                if (!proposedCode || proposedCode.trim() === fileContent.trim()) {
                    spinner.info(`No significant changes proposed for ${file}. Skipping.`);
                    continue;
                }

                spinner.text = `Verifying improvements for ${file}...`;
                const verified = await this.verifyChanges(file, proposedCode);

                if (verified) {
                    spinner.succeed(`Successfully improved and verified ${file}!`);
                    // Apply the change by overwriting the original file
                    await FileManager.write(file, proposedCode);
                    console.log(`Applied improvement to ${file}.`);

                    // Meta-Learning: Record what was learned from this successful change
                    const learning = `Successfully applied a self-improvement patch to ${file}. The analysis suggested improvements which, when implemented, passed all verification tests. This confirms the value of the analysis and generation cycle.`;
                    await CodeAnalyzer.recordMemory(file, learning, 'self-improvement, refactor, success');

                    // Stop after the first successful improvement to ensure a stable cycle.
                    return;
                } else {
                    spinner.fail(`Verification failed for ${file}. Discarding changes.`);
                }
            }
            spinner.succeed('Self-improvement cycle complete. No verifiable improvements were found in this run.');
        } catch (error) {
            spinner.fail('Self-improvement cycle failed.');
            console.error('An error occurred during the self-improvement cycle:', error);
        }
    }

    async verifyChanges(originalFilePath, proposedCode) {
        const backupFilePath = `${originalFilePath}.bak`;
        const spinner = ora(`Verifying changes for ${originalFilePath}...`).start();
        let testPassed = false;

        try {
            // 1. Backup the original file by renaming it
            await fs.rename(originalFilePath, backupFilePath);
            spinner.text = `Backed up ${originalFilePath} to ${backupFilePath}.`;

            // 2. Write the proposed code to the original file path
            await FileManager.write(originalFilePath, proposedCode);
            spinner.text = `Applied proposed changes to ${originalFilePath} for verification.`;

            // 3. Run the test suite
            spinner.text = 'Running test suite against proposed changes...';
            await execAsync('npm test');

            spinner.succeed(`Test suite passed for proposed changes to ${originalFilePath}.`);
            testPassed = true;

        } catch (error) {
            // If execAsync throws, it means the command failed (tests failed)
            spinner.fail(`Test suite failed for ${originalFilePath}.`);
            console.error('Test suite error output:', error.stdout || error.stderr);
            testPassed = false;

        } finally {
            // 4. Restore the original file from backup
            spinner.text = `Restoring original ${originalFilePath} from backup...`;
            await fs.rename(backupFilePath, originalFilePath);
            spinner.info(`Restored original ${originalFilePath}.`);
        }

        // 5. Return the result of the test run
        return testPassed;
    }
}

export default SelfImprovementAgent;