import chalk from "chalk";
import { exec } from "child_process";
import { promisify } from "util";
import { CONFIG } from "./config.js";
import FileManager from "./fileManager.js";
import CodeGenerator from "./codeGenerator.js";
import path from "path";
import ora from "ora";
import fs from "fs/promises";
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
            // Return a success message for the UI to handle
            return `✅ Memory successfully recorded for ${file}.`;
        } catch (error) {
            // Log the full error for debugging but return a user-friendly message
            console.error(chalk.red(`❌ An error occurred during memory recording for ${file}:`), error);
            return `❌ Error recording memory: ${error.message}`;
        } finally {
            await MemoryManager.disconnect();
        }
    },

    async runLintChecks(filePath) {
        console.log(`🔍 Running code quality checks for ${filePath}...`);
        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);

        const languageConfig = CONFIG.languageConfigs[language];

        if (!languageConfig || !languageConfig.linter) {
            console.log(`⚠️ No linter configured for file extension: ${fileExtension}`);
            return "";
        }

        const linter = languageConfig.linter;
        try {
            const { stdout, stderr } = await execAsync(`npx ${linter} ${filePath}`, { encoding: "utf8" });
            if (stdout) console.log(`⚠️ ${linter} warnings:\n${stdout}`);
            if (stderr) console.log(`❌ ${linter} errors:\n${stderr}`);
            if (!stdout && !stderr) console.log(`✅ ${linter} passed for ${filePath}`);
            return stdout || stderr;
        } catch (error) {
            const errorMessage = `❌ Error running ${linter}: ${error.message}`;
            console.log(errorMessage);
            console.error(errorMessage, error);
            return error.stdout || error.stderr || error.message;
        }
    },

    async fixLintErrors(filePath, lintOutput, projectStructure) {
        console.log(`🔧 Attempting to fix lint errors for ${filePath}...`);
        try {
            if (lintOutput.includes("Cannot find module")) {
                await this.createMissingFilesFromLint(lintOutput, projectStructure);
            }

            const fileContent = await FileManager.read(filePath);
            const fileExtension = path.extname(filePath);
            const language = this.getLanguageFromExtension(fileExtension);

            const prompt = PromptBuilder.buildFixLintErrorsPrompt(language, filePath, lintOutput, fileContent, projectStructure);

            const response = await getResponse(prompt);

            await FileManager.write(filePath, response.content[0].text);
            console.log(`✅ Lint errors fixed for ${filePath}`);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            const errorMessage = `❌ Error fixing lint errors for ${filePath}: ${error.message}`;
            console.log(errorMessage);
            console.error(errorMessage, error);
        }
    },

    async optimizeProjectStructure(projectStructure) {
        console.log("🔧 Optimizing project structure...");
        try {
            const prompt = PromptBuilder.buildOptimizeProjectStructurePrompt(projectStructure);

            const response = await getResponse(prompt);

            console.log("📊 Project structure optimization suggestions:");
            console.log(response.content[0].text);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            const errorMessage = `❌ Error optimizing project structure: ${error.message}`;
            console.log(errorMessage);
            console.error(errorMessage, error);
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
            console.error(chalk.red("❌ Error searching memories:"), error);
            // We can continue without memories, but we log the error.
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

        // Return all necessary data for the UI to handle the next steps
        return {
            analysis: response.content[0].text,
            fileContent,
            language,
            filePath,
            relatedMemories,
        };
    },

    async detectMissingDependencies(projectStructure) {
        console.log("🔍 Detecting missing dependencies...");
        const packageContent = await this.getPackageFileContent(projectStructure);
        const dependenciesGraph = await this.analyzeDependencies(projectStructure);
        const prompt = PromptBuilder.buildDetectMissingDependenciesPrompt(projectStructure, dependenciesGraph, packageContent);
        const response = await getResponse(prompt);

        console.log("📊 Missing dependencies analysis:");
        console.log(response.content[0].text);
        await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);

        const analysisResults = this.parseDependencyAnalysis(response.content?.[0]?.text);
        if (analysisResults) {
            await this.handleDependencyAnalysisResults(analysisResults);
        }
    },

    parseDependencyAnalysis(responseText) {
        try {
            const jsonString = responseText?.match(/```json([\s\S]*?)```/)?.[1];
            if (jsonString) {
                return JSON.parse(jsonString);
            }
        } catch (e) {
            const errorMessage = `❌ Error parsing dependency analysis results: ${e.message}`;
            console.log(errorMessage);
            console.error(errorMessage, e);
        }
        return null;
    },

    async handleDependencyAnalysisResults(results) {
        if (results.missingFiles) {
            await this.createMissingFiles(results.missingFiles);
        }
        if (results.unlistedDependencies || results.missingPackages) {
            await this.installMissingPackages(results.unlistedDependencies || results.missingPackages);
        }
    },

    async installMissingPackages(missingPackages) {
        if (!missingPackages || Object.keys(missingPackages).length === 0) {
            console.log("✅ No missing packages to install.");
            return;
        }

        console.log("📦 Found missing packages. Attempting to install...");

        for (const [language, packages] of Object.entries(missingPackages)) {
            if (packages.length > 0) {
                const languageConfig = CONFIG.languageConfigs[language];
                if (!languageConfig) {
                    console.log(`⚠️ No package manager configured for ${language}.`);
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
                        console.log(`⚠️ Automatic installation not supported for ${language} with package manager: ${packageManager}. Please install manually.`);
                        continue;
                }

                console.log(`Installing ${language} packages: ${packages.join(", ")}...`);
                try {
                    await execAsync(installCommand);
                    console.log(`✅ ${language} packages installed successfully.`);
                } catch (error) {
                    console.log(`❌ Error installing ${language} packages: ${error.message}`);
                    console.error(error); // Log full error to console for debugging
                }
            }
        }
    },

    async getPackageFileContent(projectStructure) {
        const packageFiles = [
            "package.json",
            "pom.xml",
            "build.gradle",
            "Gemfile",
            "go.mod",
            "Cargo.toml",
            "composer.json",
            "Package.swift",
            "pubspec.yaml",
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
        return "general"; // Default to general if no specific language found
    },

    extractDependencies(content, fileExtension) {
        const language = this.getLanguageFromExtension(fileExtension);

        switch (language) {
            case "javascript":
                return this.extractJavaScriptDependencies(content);
            case "python":
                return this.extractPythonDependencies(content);
            case "csharp":
                return this.extractCSharpDependencies(content);
            case "java":
                return this.extractJavaDependencies(content);
            case "ruby":
                return this.extractRubyDependencies(content);
            case "go":
                return this.extractGoDependencies(content);
            case "rust":
                return this.extractRustDependencies(content);
            case "php":
                return this.extractPHPDependencies(content);
            case "swift":
                return this.extractSwiftDependencies(content);
            case "kotlin":
                return this.extractKotlinDependencies(content);
            case "dart":
                return this.extractDartDependencies(content);
            default:
                return [];
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

    extractCSharpDependencies(content) {
        const usingRegex = /using\s+([^;]+);/g;
        const dependencies = [];
        let match;
        while ((match = usingRegex.exec(content)) !== null) {
            dependencies.push(match[1].trim());
        }
        return dependencies;
    },

    extractJavaDependencies(content) {
        const importRegex = /import\s+([^;]+);/g;
        const dependencies = [];
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            dependencies.push(match[1].trim().split(".")[0]);
        }
        return [...new Set(dependencies)];
    },

    extractRubyDependencies(content) {
        const requireRegex = /(?:require|require_relative)\s+['"]([^'"]+)['"]/g;
        const dependencies = [];
        let match;
        while ((match = requireRegex.exec(content)) !== null) {
            dependencies.push(match[1]);
        }
        return dependencies;
    },

    extractGoDependencies(content) {
        const importRegex = /import\s+(?:\(\s*|\s*)([^)]+)(?:\s*\)|\s*)/g;
        const dependencies = [];
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const imports = match[1].split("\n");
            for (const imp of imports) {
                const trimmed = imp.trim();
                if (trimmed) {
                    dependencies.push(trimmed.split(/\s+/)[0].replace(/"/g, ""));
                }
            }
        }
        return dependencies;
    },

    extractRustDependencies(content) {
        const useRegex = /use\s+([^:;]+)(?:::.*)?;/g;
        const dependencies = [];
        let match;
        while ((match = useRegex.exec(content)) !== null) {
            dependencies.push(match[1]);
        }
        return [...new Set(dependencies)];
    },

    extractPHPDependencies(content) {
        const useRegex = /use\s+([^;]+);/g;
        const dependencies = [];
        let match;
        while ((match = useRegex.exec(content)) !== null) {
            dependencies.push(match[1].split("\\")[0]);
        }
        return [...new Set(dependencies)];
    },

    extractSwiftDependencies(content) {
        const importRegex = /import\s+(\w+)/g;
        const dependencies = [];
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            dependencies.push(match[1]);
        }
        return dependencies;
    },

    extractKotlinDependencies(content) {
        const importRegex = /import\s+([^;\n]+)/g;
        const dependencies = [];
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            dependencies.push(match[1].split(".")[0]);
        }
        return [...new Set(dependencies)];
    },

    extractDartDependencies(content) {
        const importRegex = /import\s+['"]([^'"]+)['"]/g;
        const dependencies = [];
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            dependencies.push(match[1].split("/")[0]);
        }
        return [...new Set(dependencies)];
    },

    async createMissingFiles(missingFiles) {
        if (missingFiles.length === 0) return;
        console.log("📁 Creating missing files...");
        for (const filePath of missingFiles) {
            try {
                await this.addNewFile(filePath);
            } catch (error) {
                const errorMessage = `❌ Error creating file ${filePath}: ${error.message}`;
                console.log(errorMessage);
                console.error(errorMessage, error);
            }
        }
    },

    async addNewFile(filePath) {
        try {
            console.log(`➕ Adding new file: ${filePath}`);
            await FileManager.createSubfolders(filePath);
            if (!path.extname(filePath)) {
                filePath += ".js";
            }
            const fileExists = await fs.access(filePath).then(() => true).catch(() => false);

            if (!fileExists) {
                await FileManager.write(filePath, "");
                console.log(`✅ New file ${filePath} has been created.`);
            } else {
                console.log(`⚠️ File ${filePath} already exists. Skipping creation.`);
            }
        } catch (error) {
            const errorMessage = `❌ Error adding new file ${filePath}: ${error.message}`;
            console.log(errorMessage);
            console.error(errorMessage, error);
        }
    },

    async createMissingFilesFromLint(lintOutput, projectStructure) {
        const missingFileRegex = /Cannot find module '(.+?)'/g;
        const missingFiles = [...lintOutput.matchAll(missingFileRegex)].map((match) => match[1]);

        if (missingFiles.length === 0) return;

        console.log(`Found missing files from lint output: ${missingFiles.join(', ')}`);

        for (const file of missingFiles) {
            const filePath = path.join(process.cwd(), `${file}.js`);
            console.log(`Attempting to create missing file: ${filePath}`);
            await this.addNewFile(filePath);
            const generatedContent = await CodeGenerator.generate("", "", filePath, projectStructure);
            await FileManager.write(filePath, generatedContent);
            console.log(`✅ Generated content for ${filePath}`);
        }
    },

    async analyzePerformance(filePath) {
        console.log(chalk.cyan(`🚀 Analyzing performance for ${filePath}...`));
        const fileContent = await FileManager.read(filePath);
        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);

        const prompt = `
Analyze the following ${language} code for performance optimizations:

${fileContent}

Please consider:
1. Algorithmic complexity
2. Memory usage
3. I/O operations
4. Asynchronous operations (if applicable)
5. ${language}-specific performance best practices

Provide detailed performance optimization suggestions in a structured format.
`;

        const response = await getResponse(prompt);

        console.log(chalk.green(`📊 Performance analysis for ${filePath}:`));
        console.log(response.content[0].text);
        await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
    },

    async checkSecurityVulnerabilities(filePath) {
        console.log(chalk.cyan(`🔒 Checking security vulnerabilities for ${filePath}...`));
        const fileContent = await FileManager.read(filePath);
        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);

        const prompt = `
Analyze the following ${language} code for potential security vulnerabilities:

${fileContent}

Please consider:
1. Input validation and sanitization
2. Authentication and authorization issues
3. Data exposure risks
4. Cross-site scripting (XSS) vulnerabilities
5. SQL injection risks (if applicable)
6. ${language}-specific security best practices

Provide detailed security vulnerability analysis and suggestions in a structured format.
`;

        const response = await getResponse(prompt);

        console.log(chalk.green(`📊 Security vulnerability analysis for ${filePath}:`));
        console.log(response.content[0].text);
        await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
    },

    async generateUnitTests(filePath, projectStructure) {
        console.log(chalk.cyan(`🧪 Generating unit tests for ${filePath}...`));
        const fileContent = await FileManager.read(filePath);
        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);

        const prompt = `
Generate unit tests for the following ${language} code:

${fileContent}

Project structure:
${JSON.stringify(projectStructure, null, 2)}

Please consider:
1. Testing all public functions and methods
2. Covering edge cases and error scenarios
3. Mocking external dependencies
4. Achieving high code coverage
5. Following ${language}-specific testing best practices

Provide the generated unit tests in a text code format, ready to be saved in a separate test file. Do not include any explanations or comments in your response, just provide the code. Don't use md formatting or code snippets. Just code text
`;

        const spinner = ora("Generating unit tests...").start();

        try {
            const response = await getResponse(prompt);
            spinner.succeed("Unit tests generated");
            const testFilePath = filePath.replace(/\.js$/, ".test.js");
            await FileManager.write(testFilePath, response.content[0].text);
            console.log(chalk.green(`✅ Unit tests generated and saved to ${testFilePath}`));
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            spinner.fail("Error generating unit tests");
            console.error(chalk.red(`Error: ${error.message}`));
        }
    },

    async detectDeadCode() {
        console.log("🔍 Detecting dead code...");
        const projectStructure = await FileManager.getProjectStructure();
        const allFiles = await FileManager.getAllFiles();
        const fileContents = {};
        for (const file of allFiles) {
            fileContents[file] = await FileManager.read(file);
        }

        const prompt = PromptBuilder.buildDetectDeadCodePrompt(projectStructure, fileContents);
        const response = await getResponse(prompt);

        console.log("📊 Dead code analysis:");
        console.log(response.content[0].text);
    },

    async detectCodeSmells(filePath) {
        console.log(`🔍 Detecting code smells for ${filePath}...`);
        const fileContent = await FileManager.read(filePath);
        const prompt = PromptBuilder.buildDetectCodeSmellsPrompt(filePath, fileContent);
        const response = await getResponse(prompt);

        console.log(`📊 Code smell analysis for ${filePath}:`);
        console.log(response.content[0].text);
    },

    async suggestCrossFileRefactoring(files) {
        console.log("🔍 Suggesting cross-file refactoring...");
        const fileContents = {};
        for (const file of files) {
            fileContents[file] = await FileManager.read(file);
        }

        const prompt = PromptBuilder.buildSuggestCrossFileRefactoringPrompt(JSON.stringify(fileContents, null, 2));
        const response = await getResponse(prompt);

        console.log("📊 Cross-file refactoring suggestions:");
        console.log(response.content[0].text);
    },
};

export default CodeAnalyzer;