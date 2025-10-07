import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import ora from 'ora';
import chalk from 'chalk';

class ModelDownloader {
    constructor() {
        this.modelsDir = path.join(process.cwd(), 'models');
    }

    async ensureModelsDir() {
        try {
            await fs.mkdir(this.modelsDir, { recursive: true });
        } catch (error) {
            console.error(chalk.red('Failed to create models directory:'), error);
            throw error;
        }
    }

    async download(modelId, ui) {
        await this.ensureModelsDir();

        const modelName = modelId.split('/')[1];
        const targetPath = path.join(this.modelsDir, modelName);
        const repoUrl = `https://huggingface.co/${modelId}`;

        // Check if the model directory already exists
        try {
            await fs.access(targetPath);
            ui.log(chalk.yellow(`Model '${modelName}' already exists. Skipping download.`));
            return;
        } catch {
            // Directory does not exist, proceed with download
        }

        const spinner = ora(`Downloading model '${modelId}' from Hugging Face...`).start();

        return new Promise((resolve, reject) => {
            const gitProcess = spawn('git', ['clone', '--depth', '1', repoUrl, targetPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stderr = '';
            gitProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                // We can parse git's progress messages here if we want more detail
                spinner.text = `Downloading model '${modelId}': ${data.toString().trim()}`;
            });

            gitProcess.on('close', (code) => {
                if (code === 0) {
                    spinner.succeed(chalk.green(`Successfully downloaded model to ${targetPath}`));
                    resolve();
                } else {
                    spinner.fail(chalk.red(`Failed to download model. Git exited with code ${code}.`));
                    reject(new Error(stderr));
                }
            });

            gitProcess.on('error', (err) => {
                spinner.fail(chalk.red('Failed to start git process. Is git installed and in your PATH?'));
                reject(err);
            });
        });
    }
}

const modelDownloader = new ModelDownloader();
export default modelDownloader;