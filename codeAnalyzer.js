import chalk from "chalk";
import { exec } from "child_process";
import { promisify } from "util";
import { CONFIG } from "./config.js";
import FileManager from "./fileManager.js";
import CodeGenerator from "./codeGenerator.js";
import path from "path";
import fs from "fs/promises";
import logger from "./logger.js";
import { getResponse } from "./model.js";
import MemoryManager from "./server/memoryManager.js";
import PromptBuilder from "./promptBuilder.js";

const execAsync = promisify(exec);

const CodeAnalyzer = {
    async recordMemory(file, learnings, tags) {
        const dbUrl = process.env.MONGO_URI || "mongodb://localhost:27017/autocode_memory";
        await MemoryManager.connect(dbUrl);

        try {
            const project = path.basename(process.cwd());
            const code = await FileManager.read(file);
            const fileExtension = path.extname(file);
            const language = this.getLanguageFromExtension(fileExtension);

            const userTags = (tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
            const finalTags = [...new Set([language, ...userTags])];

            await MemoryManager.saveMemory({
                project,
                file,
                code,
                learnings,
                tags: finalTags,
            });
            return `✅ Memory successfully recorded for ${file}.`;
        } catch (error) {
            logger.error(chalk.red(`❌ An error occurred during memory recording for ${file}:`), error);
            return `❌ Error recording memory: ${error.message}`;
        } finally {
            await MemoryManager.disconnect();
        }
    },

    async runLintChecks(filePath) {
        logger.log(`🔍 Running code quality checks for ${filePath}...`);
        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);

        const languageConfig = CONFIG.languageConfigs[language];

        if (!languageConfig || !languageConfig.linter) {
            logger.log(`⚠️ No linter configured for file extension: ${fileExtension}`);
            return "";
        }

        const linter = languageConfig.linter;
        try {
            const { stdout, stderr } = await execAsync(`npx ${linter} ${filePath}`, { encoding: "utf8" });
            if (stdout) logger.log(`⚠️ ${linter} warnings:\n${stdout}`);
            if (stderr) logger.log(`❌ ${linter} errors:\n${stderr}`);
            if (!stdout && !stderr) logger.log(`✅ ${linter} passed for ${filePath}`);
            return stdout || stderr;
        } catch (error) {
            const errorMessage = `❌ Error running ${linter}: ${error.message}`;
            logger.log(errorMessage);
            logger.error(errorMessage, error);
            return error.stdout || error.stderr || error.message;
        }
    },

    async fixLintErrors(filePath, lintOutput, projectStructure) {
        logger.log(`🔧 Attempting to fix lint errors for ${filePath}...`);
        try {
            if (lintOutput.includes("Cannot find module")) {
                await this.createMissingFilesFromLint(lintOutput, projectStructure);
            }

            const fileContent = await FileManager.read(filePath);
            const prompt = PromptBuilder.buildFixLintErrorsPrompt(
                this.getLanguageFromExtension(path.extname(filePath)),
                filePath,
                lintOutput,
                fileContent,
                projectStructure
            );

            const response = await getResponse(prompt);

            await FileManager.write(filePath, response.content[0].text);
            logger.log(`✅ Lint errors fixed for ${filePath}`);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            const errorMessage = `❌ Error fixing lint errors for ${filePath}: ${error.message}`;
            logger.log(errorMessage);
            logger.error(errorMessage, error);
        }
    },

    async optimizeProjectStructure(projectStructure) {
        logger.log("🔧 Optimizing project structure...");
        try {
            const prompt = PromptBuilder.buildOptimizeProjectStructurePrompt(projectStructure);
            const response = await getResponse(prompt);

            logger.log("📊 Project structure optimization suggestions:");
            logger.log(response.content[0].text);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            const errorMessage = `❌ Error optimizing project structure: ${error.message}`;
            logger.log(errorMessage);
            logger.error(errorMessage, error);
        }
    },

    async analyzeCodeQuality(filePath) {
        const fileContent = await FileManager.read(filePath);
        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);

        const dbUrl = process.env.MONGO_URI || "mongodb://localhost:27017/autocode_memory";
        await MemoryManager.connect(dbUrl);
        let relatedMemories = [];
        try {
            const searchTags = [language, 'general'];
            relatedMemories = await MemoryManager.searchMemories(fileContent, searchTags);
        } catch (error) {
            logger.error(chalk.red("❌ Error searching memories:"), error);
        } finally {
            await MemoryManager.disconnect();
        }

        const memoryContext = relatedMemories.length > 0
            ? `Here are some related memories and learnings from past interactions with similar code. Use these to provide more insightful and context-aware suggestions:\n` +
              relatedMemories.map(mem => `---
File: ${mem.file}
Tags: ${mem.tags.join(', ')}
Learnings: ${mem.learnings}
Code Snippet:
\`\`\`${language}
${mem.code}
\`\`\`
---`).join('\n')
            : "No specific memories found for this code, but analyze it based on general best practices.";

        const prompt = PromptBuilder.buildAnalyzeCodeQualityPrompt(language, fileContent, memoryContext);

        const response = await getResponse(prompt);
        await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);

        return {
            analysis: response.content[0].text,
            fileContent,
            language,
            filePath,
            relatedMemories,
        };
    },

    async detectMissingDependencies(projectStructure) {
        logger.log("🔍 Detecting missing dependencies...");
        const packageContent = await this.getPackageFileContent(projectStructure);
        const dependenciesGraph = await this.analyzeDependencies(projectStructure);
        const prompt = PromptBuilder.buildDetectMissingDependenciesPrompt(projectStructure, dependenciesGraph, packageContent);
        const response = await getResponse(prompt);

        logger.log("📊 Missing dependencies analysis:");
        logger.log(response.content[0].text);
        await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);

        try {
            const jsonString = response.content?.[0]?.text?.match(/```json([\s\S]*?)```/)?.[1];
            if (jsonString) {
                const structuredResults = JSON.parse(jsonString);
                if (structuredResults) {
                    await this.createMissingFiles(structuredResults?.missingFiles || []);
                    await this.installMissingPackages(structuredResults?.unlistedDependencies || structuredResults?.missingPackages || {});
                }
            }
        } catch (e) {
            const errorMessage = `❌ Error parsing or processing dependency analysis results: ${e.message}`;
            logger.log(errorMessage);
            logger.error(errorMessage, e);
        }
    },

    async installMissingPackages(missingPackages) {
        if (!missingPackages || Object.keys(missingPackages).length === 0) {
            logger.log("✅ No missing packages to install.");
            return;
        }

        logger.log("📦 Found missing packages. Attempting to install...");

        for (const [language, packages] of Object.entries(missingPackages)) {
            if (packages.length > 0) {
                const languageConfig = CONFIG.languageConfigs[language];
                if (!languageConfig) {
                    logger.log(`⚠️ No package manager configured for ${language}.`);
                    continue;
                }

                const packageManager = languageConfig.packageManager;
                let installCommand;
                switch (packageManager) {
                    case "npm": installCommand = `npm install ${packages.join(" ")}`; break;
                    case "pip": installCommand = `pip install ${packages.join(" ")}`; break;
                    case "bundler": installCommand = `bundle add ${packages.join(" ")}`; break;
                    case "composer": installCommand = `composer require ${packages.join(" ")}`; break;
                    case "cargo": installCommand = `cargo add ${packages.join(" ")}`; break;
                    default:
                        logger.log(`⚠️ Automatic installation not supported for ${language} with package manager: ${packageManager}. Please install manually.`);
                        continue;
                }

                logger.log(`Installing ${language} packages: ${packages.join(", ")}...`);
                try {
                    await execAsync(installCommand);
                    logger.log(`✅ ${language} packages installed successfully.`);
                } catch (error) {
                    logger.log(`❌ Error installing ${language} packages: ${error.message}`);
                    logger.error(error);
                }
            }
        }
    },

    async getPackageFileContent(projectStructure) {
        const packageFiles = [
            "package.json", "pom.xml", "build.gradle", "Gemfile", "go.mod",
            "Cargo.toml", "composer.json", "Package.swift", "pubspec.yaml",
        ];

        for (const file of packageFiles) {
            const matchingFile = Object.keys(projectStructure).find((key) => key.match(new RegExp(file)));
            if (matchingFile) {
                return FileManager.read(matchingFile);
            }
        }

        return "No package file found";
    },

    async analyzeDependencies(projectStructure) {
        const dependencies = {};
        for (const [key, value] of Object.entries(projectStructure)) {
            if (typeof value === "object" && value !== null) {
                for (const [subKey, subValue] of Object.entries(value)) {
                    if (subValue === null) {
                        const filePath = `${key}/${subKey}`;
                        const content = await FileManager.read(filePath);
                        dependencies[filePath] = this.extractDependencies(content, path.extname(filePath));
                    }
                }
            } else if (value === null) {
                const content = await FileManager.read(key);
                dependencies[key] = this.extractDependencies(content, path.extname(key));
            }
        }
        return dependencies;
    },

    getLanguageFromExtension(fileExtension) {
        for (const [language, config] of Object.entries(CONFIG.languageConfigs)) {
            if (config.fileExtensions.includes(fileExtension)) {
                return language;
            }
        }
        return "general";
    },

    extractDependencies(content, fileExtension) {
        const language = this.getLanguageFromExtension(fileExtension);
        switch (language) {
            case "javascript": return this.extractJavaScriptDependencies(content);
            case "python": return this.extractPythonDependencies(content);
            // ... other languages
            default: return [];
        }
    },

    extractJavaScriptDependencies(content) {
        const importRegex =
            /(?:import\s+(?:\*\s+as\s+\w+\s+from\s+['"](.+?)['"]|{\s*[\w\s,]+\s*}\s+from\s+['"](.+?)['"]|\w+\s+from\s+['"](.+?)['"])|lazy\(\s*\(\)\s*=>\s*import\(['"](.+?)['"]\)\s*\))/g;
        const dependencies = [];
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const dependency = match[1] || match[2] || match[3] || match[4];
            dependencies.push(dependency);
        }
        return dependencies;
    },

    extractPythonDependencies(content) {
        const importRegex = /(?:from\s+(\S+)\s+import|\bimport\s+(\S+))/g;
        const dependencies = [];
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const dependency = match[1] || match[2];
            dependencies.push(dependency.split(".")[0]);
        }
        return [...new Set(dependencies)];
    },

    async createMissingFiles(missingFiles) {
        if (missingFiles.length === 0) return;
        logger.log("📁 Creating missing files...");
        for (const filePath of missingFiles) {
            try {
                await this.addNewFile(filePath);
            } catch (error) {
                const errorMessage = `❌ Error creating file ${filePath}: ${error.message}`;
                logger.log(errorMessage);
                logger.error(errorMessage, error);
            }
        }
    },

    async addNewFile(filePath) {
        try {
            logger.log(`➕ Adding new file: ${filePath}`);
            await FileManager.createSubfolders(filePath);
            if (!path.extname(filePath)) {
                filePath += ".js";
            }
            const fileExists = await fs.access(filePath).then(() => true).catch(() => false);

            if (!fileExists) {
                await FileManager.write(filePath, "");
                logger.log(`✅ New file ${filePath} has been created.`);
            } else {
                logger.log(`⚠️ File ${filePath} already exists. Skipping creation.`);
            }
        } catch (error) {
            const errorMessage = `❌ Error adding new file ${filePath}: ${error.message}`;
            logger.log(errorMessage);
            logger.error(errorMessage, error);
        }
    },

    async createMissingFilesFromLint(lintOutput, projectStructure) {
        const missingFileRegex = /Cannot find module '(.+?)'/g;
        const missingFiles = [...lintOutput.matchAll(missingFileRegex)].map((match) => match[1]);

        if (missingFiles.length === 0) return;

        logger.log(`Found missing files from lint output: ${missingFiles.join(', ')}`);

        for (const file of missingFiles) {
            const filePath = path.join(process.cwd(), `${file}.js`);
            logger.log(`Attempting to create missing file: ${filePath}`);
            await this.addNewFile(filePath);
            const generatedContent = await CodeGenerator.generate("", "", filePath, projectStructure);
            await FileManager.write(filePath, generatedContent);
            logger.log(`✅ Generated content for ${filePath}`);
        }
    },

    async analyzePerformance(filePath) {
        logger.log(chalk.cyan(`🚀 Analyzing performance for ${filePath}...`));
        const fileContent = await FileManager.read(filePath);
        const language = this.getLanguageFromExtension(path.extname(filePath));

        const prompt = `
Analyze the following ${language} code for performance optimizations...`; // Simplified for brevity

        const response = await getResponse(prompt);

        logger.log(chalk.green(`📊 Performance analysis for ${filePath}:`));
        logger.log(response.content[0].text);
        await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
    },

    async checkSecurityVulnerabilities(filePath) {
        logger.log(chalk.cyan(`🔒 Checking security vulnerabilities for ${filePath}...`));
        const fileContent = await FileManager.read(filePath);
        const language = this.getLanguageFromExtension(path.extname(filePath));

        const prompt = `
Analyze the following ${language} code for potential security vulnerabilities...`; // Simplified for brevity

        const response = await getResponse(prompt);

        logger.log(chalk.green(`📊 Security vulnerability analysis for ${filePath}:`));
        logger.log(response.content[0].text);
        await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
    },

    async generateUnitTests(filePath, projectStructure) {
        logger.log(chalk.cyan(`🧪 Generating unit tests for ${filePath}...`));
        const fileContent = await FileManager.read(filePath);
        const language = this.getLanguageFromExtension(path.extname(filePath));

        const prompt = `
Generate unit tests for the following ${language} code...`; // Simplified for brevity

        logger.startSpinner("Generating unit tests...");
        try {
            const response = await getResponse(prompt);
            logger.stopSpinner(true, "Unit tests generated");
            const testFilePath = filePath.replace(/\.js$/, ".test.js");
            await FileManager.write(testFilePath, response.content[0].text);
            logger.log(chalk.green(`✅ Unit tests generated and saved to ${testFilePath}`));
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            logger.stopSpinner(false, "Error generating unit tests");
            logger.error(chalk.red(`Error: ${error.message}`));
        }
    },

    async detectDeadCode() {
        logger.log("🔍 Detecting dead code...");
        const projectStructure = await FileManager.getProjectStructure();
        const allFiles = await FileManager.getAllFiles();
        const fileContents = {};
        for (const file of allFiles) {
            fileContents[file] = await FileManager.read(file);
        }

        const prompt = PromptBuilder.buildDetectDeadCodePrompt(projectStructure, fileContents);
        const response = await getResponse(prompt);

        logger.log("📊 Dead code analysis:");
        logger.log(response.content[0].text);
    },

    async detectCodeSmells(filePath) {
        logger.log(`🔍 Detecting code smells for ${filePath}...`);
        const fileContent = await FileManager.read(filePath);
        const prompt = PromptBuilder.buildDetectCodeSmellsPrompt(filePath, fileContent);
        const response = await getResponse(prompt);

        logger.log(`📊 Code smell analysis for ${filePath}:`);
        logger.log(response.content[0].text);
    },

    async suggestCrossFileRefactoring(files) {
        logger.log("🔍 Suggesting cross-file refactoring...");
        const fileContents = {};
        for (const file of files) {
            fileContents[file] = await FileManager.read(file);
        }

        const prompt = PromptBuilder.buildSuggestCrossFileRefactoringPrompt(JSON.stringify(fileContents, null, 2));
        const response = await getResponse(prompt);

        logger.log("📊 Cross-file refactoring suggestions:");
        logger.log(response.content[0].text);
    },
};

export default CodeAnalyzer;