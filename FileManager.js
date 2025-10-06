import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import ignore from "ignore";
import { CONFIG } from "./config.js";

const FileManager = {
    async read(filePath) {
        try {
            return await fs.readFile(filePath, "utf8");
        } catch (error) {
            // Don't log an error for a missing .gitignore, as it's optional.
            if (!filePath.includes(".gitignore")) {
                 console.error(chalk.red(`Error reading file ${filePath}: ${error.message}`));
            }
            return null;
        }
    },

    async write(filePath, content) {
        try {
            await this.createSubfolders(filePath);
            await fs.writeFile(filePath, content, "utf8");
            console.log(chalk.green(`✅ File ${filePath} has been updated.`));
        } catch (error) {
            console.error(chalk.red(`❌ Error writing file ${filePath}:`), error);
        }
    },

    async createSubfolders(filePath) {
        const dir = path.dirname(filePath);
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            console.error(chalk.red(`❌ Error creating directory ${dir}:`), error);
        }
    },

    async getFilesToProcess() {
        const gitignorePath = path.join(process.cwd(), ".gitignore");
        const gitignoreContent = (await this.read(gitignorePath)) || "";
        const ig = ignore().add(gitignoreContent);

        const files = await fs.readdir(process.cwd(), { withFileTypes: true, recursive: true });

        return files
            .filter((file) => {
                const relativePath = path.relative(process.cwd(), path.join(file.path, file.name));
                return (
                    file.isFile() &&
                    !ig.ignores(relativePath) &&
                    !CONFIG.excludedFiles.includes(file.name) &&
                    !CONFIG.excludedDirs.some((dir) => relativePath.startsWith(dir)) &&
                    !CONFIG.excludedExtensions.includes(path.extname(file.name).toLowerCase())
                );
            })
            .map((file) => path.relative(process.cwd(), path.join(file.path, file.name)));
    },

    async getProjectStructure() {
        const files = await this.getFilesToProcess();
        const structure = {};
        files.forEach(file => {
            const parts = file.split(path.sep);
            let current = structure;
            parts.forEach((part, index) => {
                if (index === parts.length - 1) {
                    current[part] = null;
                } else {
                    current[part] = current[part] || {};
                    current = current[part];
                }
            });
        });
        return structure;
    },

    async discoverLocalModels() {
        const modelsDir = path.join(process.cwd(), 'models');
        try {
            const entries = await fs.readdir(modelsDir, { withFileTypes: true });
            const modelDirs = entries
                .filter(entry => entry.isDirectory())
                .map(entry => path.join(modelsDir, entry.name));
            return modelDirs;
        } catch (error) {
            if (error.code === 'ENOENT') {
                // The models directory doesn't exist, which is fine.
                console.log(chalk.yellow("Models directory not found. No local models discovered."));
                return [];
            }
            console.error(chalk.red('❌ Error discovering local models:'), error);
            return [];
        }
    },
};

export default FileManager;