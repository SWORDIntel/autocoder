import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import logger from './logger.js';

class ModelDownloader {
    constructor() {
        this.modelsDir = path.join(process.cwd(), 'models');
    }

    async ensureModelsDir() {
        try {
            await fs.mkdir(this.modelsDir, { recursive: true });
        } catch (error) {
            logger.error(chalk.red('Failed to create models directory:'), error);
            throw error;
        }
    }

    async download(modelId) {
        await this.ensureModelsDir();

        const modelName = modelId.split('/')[1];
        const targetPath = path.join(this.modelsDir, modelName);
        const repoUrl = `https://huggingface.co/${modelId}`;

        try {
            await fs.access(targetPath);
            logger.log(chalk.yellow(`Model '${modelName}' already exists. Skipping download.`));
            return;
        } catch {
            // Directory does not exist, proceed with download
        }

        logger.log(`Downloading model '${modelId}' from Hugging Face...`);

        return new Promise((resolve, reject) => {
            const gitProcess = spawn('git', ['clone', '--depth', '1', repoUrl, targetPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stderr = '';
            gitProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                logger.log(`Downloading model '${modelId}': ${data.toString().trim()}`);
            });

            gitProcess.on('close', (code) => {
                if (code === 0) {
                    logger.log(chalk.green(`Successfully downloaded model to ${targetPath}`));
                    resolve();
                } else {
                    logger.error(chalk.red(`Failed to download model. Git exited with code ${code}.`));
                    reject(new Error(stderr));
                }
            });

            gitProcess.on('error', (err) => {
                logger.error(chalk.red('Failed to start git process. Is git installed and in your PATH?'), err);
                reject(err);
            });
        });
    }
}

const modelDownloader = new ModelDownloader();
export default modelDownloader;