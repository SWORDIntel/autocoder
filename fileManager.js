import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import ignore from "ignore";
import { CONFIG } from "./config.js";
import logger from "./logger.js";

const FileManager = {
    async read(filePath) {
        try {
            return await fs.readFile(filePath, "utf8");
        } catch {
            if (filePath.includes(".gitignore")) {
                return null; 
            }
            logger.error(chalk.red(`Error reading file ${filePath}`));
            return null;
        }
    },

    async write(filePath, content) {
        try {
            await this.createSubfolders(filePath);
            await fs.writeFile(filePath, content, "utf8");
            logger.log(chalk.green(`✅ File ${filePath} has been updated.`));
        } catch (error) {
            logger.error(chalk.red(`❌ Error writing file ${filePath}:`), error);
        }
    },

    async createSubfolders(filePath) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
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
        return files.reduce((acc, file) => {
            const parts = file.split(path.sep);
            let current = acc;
            parts.forEach((part, index) => {
                if (index === parts.length - 1) {
                    current[part] = null;
                } else {
                    current[part] = current[part] || {};
                    current = current[part];
                }
            });
            return acc;
        }, {});
    },

    getLanguageConfig(filePath) {
        const extension = path.extname(filePath).toLowerCase();
        for (const [language, config] of Object.entries(CONFIG.languageConfigs)) {
            if (config.fileExtensions.includes(extension)) {
                return { language, ...config };
            }
        }
        return null;
    },

    async detectMissingFiles(requiredFiles) {
        const existingFiles = await this.getFilesToProcess();
        const missingFiles = requiredFiles.filter((file) => !existingFiles.includes(file));
        return missingFiles;
    },

    async createFile(filePath, content = "") {
        try {
            await this.createSubfolders(filePath);
            await fs.writeFile(filePath, content, "utf8");
            logger.log(chalk.green(`✅ File ${filePath} has been created.`));
        } catch (error) {
            logger.error(chalk.red(`❌ Error creating file ${filePath}:`), error);
        }
    },

    async deleteFile(filePath) {
        try {
            await fs.unlink(filePath);
            logger.log(chalk.yellow(`🗑️ File ${filePath} has been deleted.`));
        } catch (error) {
            logger.error(chalk.red(`❌ Error deleting file ${filePath}:`), error);
        }
    },

    async renameFile(oldPath, newPath) {
        try {
            await fs.rename(oldPath, newPath);
            logger.log(chalk.blue(`🔄 File renamed from ${oldPath} to ${newPath}.`));
        } catch (error) {
            logger.error(chalk.red(`❌ Error renaming file from ${oldPath} to ${newPath}:`), error);
        }
    },

    async copyFile(sourcePath, destinationPath) {
        try {
            await fs.copyFile(sourcePath, destinationPath);
            logger.log(chalk.magenta(`📋 File copied from ${sourcePath} to ${destinationPath}.`));
        } catch (error) {
            logger.error(chalk.red(`❌ Error copying file from ${sourcePath} to ${destinationPath}:`), error);
        }
    },

    async getFileStats(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime,
            };
        } catch (error) {
            logger.error(chalk.red(`❌ Error getting stats for file ${filePath}:`), error);
            return null;
        }
    },

    async listDirectoryContents(dirPath) {
        try {
            const contents = await fs.readdir(dirPath, { withFileTypes: true });
            return contents.map((item) => ({
                name: item.name,
                isDirectory: item.isDirectory(),
                isFile: item.isFile(),
            }));
        } catch (error) {
            logger.error(chalk.red(`❌ Error listing contents of directory ${dirPath}:`), error);
            return [];
        }
    },

    async discoverLocalModels() {
        const modelsDir = path.join(process.cwd(), 'models');
        try {
            await fs.access(modelsDir); // Check if the directory exists
            const entries = await fs.readdir(modelsDir, { withFileTypes: true });
            const modelDirs = entries
                .filter(dirent => dirent.isDirectory())
                .map(dirent => path.join(modelsDir, dirent.name));
            return modelDirs;
        } catch (error) {
            if (error.code === 'ENOENT') {
                // This is a common case, not necessarily an error.
                logger.log(chalk.yellow("The 'models' directory does not exist. No local models discovered."));
            } else {
                logger.error(chalk.red(`❌ Error discovering local models in ${modelsDir}:`), error);
            }
            return [];
        }
    },
};

export default FileManager;