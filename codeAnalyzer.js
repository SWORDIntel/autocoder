import chalk from "chalk";
import { exec } from "child_process";
import { promisify } from "util";
import { CONFIG } from "./config.js";
import FileManager from "./fileManager.js";
import CodeGenerator from "./codeGenerator.js";
import path from "path";
import inquirer from "inquirer";
import ora from "ora";
import fs from "fs/promises";
import { getResponse } from "./model.js";
import MemoryManager from "./server/memoryManager.js";

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

    async runLintChecks(filePath, ui) {
        ui.log(`🔍 Running code quality checks for ${filePath}...`);
        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);

        if (!language) {
            ui.log(`⚠️ No linter configured for file extension: ${fileExtension}`);
            return "";
        }

        const linter = CONFIG.languageConfigs[language].linter;
        try {
            const { stdout, stderr } = await execAsync(`npx ${linter} ${filePath}`, { encoding: "utf8" });
            if (stdout) ui.log(`⚠️ ${linter} warnings:\n${stdout}`);
            if (stderr) ui.log(`❌ ${linter} errors:\n${stderr}`);
            if (!stdout && !stderr) ui.log(`✅ ${linter} passed for ${filePath}`);
            return stdout || stderr;
        } catch (error) {
            const errorMessage = `❌ Error running ${linter}: ${error.message}`;
            ui.log(errorMessage);
            console.error(errorMessage, error);
            return error.stdout || error.stderr || error.message;
        }
    },

    async fixLintErrors(filePath, lintOutput, projectStructure, ui) {
        ui.log(`🔧 Attempting to fix lint errors for ${filePath}...`);
        try {
            if (lintOutput.includes("Cannot find module")) {
                await this.createMissingFilesFromLint(lintOutput, projectStructure, ui);
            }

            const fileContent = await FileManager.read(filePath);
            const fileExtension = path.extname(filePath);
            const language = this.getLanguageFromExtension(fileExtension);

            const prompt = `
Please fix the following linter errors in the ${language} file ${filePath}:
${lintOutput}
Current file content:
${fileContent}
Project structure:
${JSON.stringify(projectStructure, null, 2)}
Please provide the corrected code that addresses all the linter errors. Consider the project structure when making changes. Do not include any explanations or comments in your response, just provide the code.`;

            const response = await getResponse(prompt);

            await FileManager.write(filePath, response.content[0].text);
            ui.log(`✅ Lint errors fixed for ${filePath}`);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            const errorMessage = `❌ Error fixing lint errors for ${filePath}: ${error.message}`;
            ui.log(errorMessage);
            console.error(errorMessage, error);
        }
    },

    async optimizeProjectStructure(projectStructure, ui) {
        ui.log("🔧 Optimizing project structure...");
        try {
            const prompt = `
Analyze the following project structure and provide optimization suggestions:

${JSON.stringify(projectStructure, null, 2)}

Please provide suggestions for optimizing the project structure, including:
1. Reorganizing files and folders
2. Splitting or merging modules
3. Improving naming conventions
4. Enhancing overall project architecture

Provide the suggestions in a structured format.
`;

            const response = await getResponse(prompt);

            ui.log("📊 Project structure optimization suggestions:");
            ui.log(response.content[0].text);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            const errorMessage = `❌ Error optimizing project structure: ${error.message}`;
            ui.log(errorMessage);
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

        const prompt = `
Analyze the following ${language} code for quality and provide improvement suggestions:
${fileContent}
${memoryContext}
Please consider:
1. Adherence to DRY, KISS, and SRP principles
2. Code readability and maintainability
3. Potential performance improvements
4. Error handling and edge cases
5. Security considerations
6. ${language}-specific best practices
Provide the suggestions in a structured format.`;

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

    async detectMissingDependencies(projectStructure, ui) {
        ui.log("🔍 Detecting missing dependencies...");
        const packageContent = await this.getPackageFileContent(projectStructure);
        const prompt = `
     Analyze the following project structure and detect any missing dependencies or files:
    
     ${JSON.stringify(projectStructure, null, 2)}
    
     Dependencies graph:
    
     ${JSON.stringify(await this.analyzeDependencies(projectStructure), null, 2)}
    
     Package file content:
     ${packageContent}
    
     Please identify:
     1. Missing packages based on import statements for each supported language (e.g., {"javascript": ["react"], "python": ["numpy"]})
     2. Missing files that are referenced but not present in the project structure (please always return filenames based on repo root)
     3. Potential circular dependencies
     4. Dependencies listed in the package file but not used in the project
     5. Dependencies used in the project but not listed in the package file
    
     Provide the results in a single JSON code snippet.
     `;
        const response = await getResponse(prompt);

        ui.log("📊 Missing dependencies analysis:");
        ui.log(response.content[0].text);
        await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);

        try {
            const jsonString = response.content?.[0]?.text?.match(/```json([\s\S]*?)```/)?.[1];
            if (jsonString) {
                const structuredResults = JSON.parse(jsonString);
                if (structuredResults) {
                    await this.createMissingFiles(structuredResults?.missingFiles || [], ui);
                    await this.installMissingPackages(structuredResults?.unlistedDependencies || structuredResults?.missingPackages || {}, ui);
                }
            }
        } catch (e) {
            const errorMessage = `❌ Error parsing or processing dependency analysis results: ${e.message}`;
            ui.log(errorMessage);
            console.error(errorMessage, e);
        }
    },

    async installMissingPackages(missingPackages, ui) {
        if (!missingPackages || Object.keys(missingPackages).length === 0) {
            ui.log("✅ No missing packages to install.");
            return;
        }

        ui.log("📦 Found missing packages. Attempting to install...");

        for (const [language, packages] of Object.entries(missingPackages)) {
            if (packages.length > 0) {
                const languageConfig = CONFIG.languageConfigs[language];
                if (!languageConfig) {
                    ui.log(`⚠️ No package manager configured for ${language}.`);
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
                        ui.log(`⚠️ Automatic installation not supported for ${language} with package manager: ${packageManager}. Please install manually.`);
                        continue;
                }

                ui.log(`Installing ${language} packages: ${packages.join(", ")}...`);
                try {
                    await execAsync(installCommand);
                    ui.log(`✅ ${language} packages installed successfully.`);
                } catch (error) {
                    ui.log(`❌ Error installing ${language} packages: ${error.message}`);
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

    async createMissingFiles(missingFiles, ui) {
        if (missingFiles.length === 0) return;
        ui.log("📁 Creating missing files...");
        for (const filePath of missingFiles) {
            try {
                await this.addNewFile(filePath, ui);
            } catch (error) {
                const errorMessage = `❌ Error creating file ${filePath}: ${error.message}`;
                ui.log(errorMessage);
                console.error(errorMessage, error);
            }
        }
    },

    async addNewFile(filePath, ui) {
        try {
            ui.log(`➕ Adding new file: ${filePath}`);
            await FileManager.createSubfolders(filePath);
            if (!path.extname(filePath)) {
                filePath += ".js";
            }
            const fileExists = await fs.access(filePath).then(() => true).catch(() => false);

            if (!fileExists) {
                await FileManager.write(filePath, "");
                ui.log(`✅ New file ${filePath} has been created.`);
            } else {
                ui.log(`⚠️ File ${filePath} already exists. Skipping creation.`);
            }
        } catch (error) {
            const errorMessage = `❌ Error adding new file ${filePath}: ${error.message}`;
            ui.log(errorMessage);
            console.error(errorMessage, error);
        }
    },

    async createMissingFilesFromLint(lintOutput, projectStructure, ui) {
        const missingFileRegex = /Cannot find module '(.+?)'/g;
        const missingFiles = [...lintOutput.matchAll(missingFileRegex)].map((match) => match[1]);

        if (missingFiles.length === 0) return;

        ui.log(`Found missing files from lint output: ${missingFiles.join(', ')}`);

        for (const file of missingFiles) {
            const filePath = path.join(process.cwd(), `${file}.js`);
            ui.log(`Attempting to create missing file: ${filePath}`);
            await this.addNewFile(filePath, ui);
            const generatedContent = await CodeGenerator.generate("", "", filePath, projectStructure);
            await FileManager.write(filePath, generatedContent);
            ui.log(`✅ Generated content for ${filePath}`);
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

    async generateUnitTests(filePath, projectStructure, ui) {
        ui.log(`🧪 Generating unit tests for ${filePath}...`);
        const fileContent = await FileManager.read(filePath);
        if (!fileContent) {
            ui.log(`⚠️ Could not read file ${filePath}.`);
            return;
        }
        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);

        const prompt = `
Generate a complete, runnable unit test file for the following ${language} code.

File to test: ${filePath}
Content:
${fileContent}

Project Structure:
${JSON.stringify(projectStructure, null, 2)}

Requirements for the test file:
1.  Use the appropriate testing framework for ${language} (e.g., Jest for JavaScript, pytest for Python).
2.  Mock any external dependencies or modules to ensure the unit test is isolated.
3.  Cover the main functionality of the public methods/functions.
4.  Include tests for common edge cases (e.g., null inputs, empty arrays).
5.  Follow best practices for writing clean and maintainable tests in ${language}.

Return only the raw code for the test file. Do not include any explanations, comments, or markdown formatting.
`;

        const spinner = ora("Generating unit tests...").start();
        try {
            const response = await getResponse(prompt);
            spinner.succeed("Unit tests generated.");
            const testCode = CodeGenerator.cleanGeneratedCode(response.content[0].text);
            const testFilePath = filePath.replace(/(\.[\w\d_]+)$/, '.test$1');
            await FileManager.write(testFilePath, testCode);
            ui.log(`✅ Unit tests generated and saved to ${testFilePath}`);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            spinner.fail("Error generating unit tests.");
            ui.log(`❌ Error generating unit tests: ${error.message}`);
            console.error(error);
        }
    },

    async checkSecurityVulnerabilities(filePath, ui) {
        ui.log(`🔒 Checking security vulnerabilities for ${filePath}...`);
        const fileContent = await FileManager.read(filePath);
        if (!fileContent) {
            ui.log(`⚠️ Could not read file ${filePath}.`);
            return;
        }
        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);

        const prompt = `
Analyze the following ${language} code for potential security vulnerabilities:

${fileContent}

Please consider:
1. Input validation and sanitization (e.g., for XSS, command injection).
2. Hardcoded secrets or credentials.
3. Insecure use of cryptographic functions.
4. Authentication and authorization flaws.
5. Data exposure risks (e.g., logging sensitive information).
6. SQL injection risks (if applicable).
7. Use of outdated or vulnerable dependencies.
8. ${language}-specific security best practices.

Provide a detailed security vulnerability analysis and concrete suggestions for fixing them. Structure the output clearly.
`;
        const spinner = ora("Analyzing for security vulnerabilities...").start();
        try {
            const response = await getResponse(prompt);
            spinner.succeed(`Security analysis for ${filePath} completed.`);
            ui.log(`\n📊 Security Vulnerability Analysis for ${filePath}:\n`);
            ui.log(response.content[0].text);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            spinner.fail("Error during security analysis.");
            ui.log(`❌ Error checking security vulnerabilities: ${error.message}`);
            console.error(error);
        }
    },

    async analyzePerformance(filePath, ui) {
        ui.log(`🚀 Analyzing performance for ${filePath}...`);
        const fileContent = await FileManager.read(filePath);
        if (!fileContent) {
            ui.log(`⚠️ Could not read file ${filePath}.`);
            return;
        }
        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);

        const prompt = `
Analyze the following ${language} code for performance optimizations:

${fileContent}

Please consider:
1. Algorithmic complexity (e.g., O(n^2) loops that could be O(n)).
2. Memory usage and potential memory leaks.
3. I/O operations (e.g., synchronous file reads in an async context).
4. Asynchronous operations (e.g., Promise handling, race conditions).
5. ${language}-specific performance best practices (e.g., using streams in Node.js, list comprehensions in Python).

Provide detailed performance optimization suggestions and concrete code examples for fixing them. Structure the output clearly.
`;
        const spinner = ora("Analyzing for performance optimizations...").start();
        try {
            const response = await getResponse(prompt);
            spinner.succeed(`Performance analysis for ${filePath} completed.`);
            ui.log(`\n🚀 Performance Analysis for ${filePath}:\n`);
            ui.log(response.content[0].text);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            spinner.fail("Error during performance analysis.");
            ui.log(`❌ Error analyzing performance: ${error.message}`);
            console.error(error);
        }
    },

    async detectDeadCode(projectStructure, ui) {
        ui.log("🗑️ Detecting dead code...");
        const spinner = ora("Analyzing for dead code...").start();

        try {
            const allFiles = await FileManager.getFilesToProcess();
            const allFileContents = {};
            for (const file of allFiles) {
                allFileContents[file] = await FileManager.read(file);
            }

            const prompt = `
You are an expert static analysis tool. Analyze the entire codebase provided below to find dead or unreachable code.

Project Structure:
${JSON.stringify(projectStructure, null, 2)}

All File Contents:
${JSON.stringify(allFileContents, null, 2)}

Please identify:
1.  **Unused Exports:** Functions, classes, or variables that are exported from a module but never imported or used by any other module.
2.  **Unused Functions/Classes:** Functions or classes that are defined within a file but never called or instantiated within that file or any other file.
3.  **Unreachable Code:** Code blocks that can never be executed (e.g., code after a return statement).

For each piece of dead code found, provide the file path, the name of the function/class/variable, and the line number.
`;

            const response = await getResponse(prompt);
            spinner.succeed("Dead code analysis complete.");
            ui.log(`\n🗑️ Dead Code Report:\n`);
            ui.log(response.content[0].text);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);

        } catch (error) {
            spinner.fail("Error during dead code detection.");
            ui.log(`❌ Error detecting dead code: ${error.message}`);
            console.error(error);
        }
    },

    async suggestCrossFileRefactoring(filePaths, projectStructure, ui) {
        ui.log(`🧠 Analyzing files for cross-file refactoring opportunities...`);
        const spinner = ora("Analyzing files...").start();

        try {
            const fileContents = {};
            for (const filePath of filePaths) {
                fileContents[filePath] = await FileManager.read(filePath);
            }

            const prompt = `
You are an expert software architect specializing in identifying cross-cutting concerns and refactoring opportunities. Analyze the following files from a project.

Project Structure:
${JSON.stringify(projectStructure, null, 2)}

Files to Analyze:
${Object.entries(fileContents).map(([path, code]) => `
--- File: ${path} ---
\`\`\`
${code}
\`\`\`
`).join('\n')}

Please identify opportunities for cross-file refactoring. Focus on:
1.  **Duplicated Logic:** Identify functions, classes, or blocks of code that are duplicated across the provided files.
2.  **Shared Concerns:** Find related logic that could be extracted into a new, shared utility module.
3.  **Improving Cohesion:** Suggest moving functions or logic to a different file where they would be more logically located.

For each suggestion, provide:
- A clear description of the problem.
- The file paths and specific code snippets involved.
- A concrete refactoring plan, including the name of any new files to be created and the code they should contain.
`;

            const response = await getResponse(prompt);
            spinner.succeed("Cross-file refactoring analysis complete.");
            ui.log(`\n🧠 Cross-File Refactoring Suggestions:\n`);
            ui.log(response.content[0].text);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);

        } catch (error) {
            spinner.fail("Error during cross-file refactoring analysis.");
            ui.log(`❌ Error analyzing for cross-file refactoring: ${error.message}`);
            console.error(error);
        }
    },
};

export default CodeAnalyzer;