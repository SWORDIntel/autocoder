import { CONFIG } from "./config.js";
import chalk from "chalk";
import path from "path";
import FileManager from "./fileManager.js";
import CodeAnalyzer from "./codeAnalyzer.js";
import DocumentationGenerator from "./documentationGenerator.js";
import fs from "fs/promises";
import { getResponse } from "./model.js";
import UserInterface from "./userInterface.js";
import PromptBuilder from "./promptBuilder.js";

const DEFAULT_MAX_NEW_TOKENS = 4096;

const CodeGenerator = {
    async generate(readme, currentCode, fileName, projectStructure, allFileContents) {
        const fileExtension = path.extname(fileName);
        const language = this.getLanguageFromExtension(fileExtension);
        const languageConfig = CONFIG.languageConfigs[language];

        const prompt = PromptBuilder.buildGeneratePrompt(
            fileName,
            readme,
            currentCode,
            projectStructure,
            allFileContents,
            language,
            fileExtension,
            languageConfig.linter,
            languageConfig.formatter,
            languageConfig.packageManager
        );

        console.log("Generating code...");

        try {
            const response = await getResponse(prompt, undefined, DEFAULT_MAX_NEW_TOKENS);
            console.log("Code generated successfully");
            await this.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
            return this.cleanGeneratedCode(response.content[0].text);
        } catch (error) {
            console.error("Error generating code");
            throw error;
        }
    },

    cleanGeneratedCode(code) {
        const codeBlockRegex =
            /`{3,4}(?:javascript|js|jsx|css|yaml|ts|tsx|markdown|json|html|python|csharp|java|ruby|go|rust|php|swift|kotlin|dart)?\n([\s\S]*?)\n`{3,4}/;
        const match = code.match(codeBlockRegex);
        return match ? match[1] : code;
    },

    async updateReadme(readme, projectStructure) {
        const prompt = PromptBuilder.buildUpdateReadmePrompt(readme, projectStructure);

        console.log("Updating README...");

        try {
            const response = await getResponse(prompt, undefined, DEFAULT_MAX_NEW_TOKENS);
            console.log("README updated successfully");
            const updatedReadme = this.cleanGeneratedCode(response.content[0].text);
            await this.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
            return updatedReadme;
        } catch (error) {
            console.error("Error updating README");
            throw error;
        }
    },

    async splitLargeFile(filePath, content, projectStructure) {
        console.log(chalk.yellow(`📂 File ${filePath} exceeds ${CONFIG.maxFileLines} lines. Splitting...`));

        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);

        const prompt = PromptBuilder.buildSplitLargeFilePrompt(
            filePath,
            CONFIG.maxFileLines,
            language,
            content,
            projectStructure
        );

        console.log("Generating file split suggestion...");

        try {
            const response = await getResponse(prompt, undefined, undefined, DEFAULT_MAX_NEW_TOKENS);
            console.log("File split suggestion generated");
            const splitSuggestion = response.content[0].text;
            console.log(chalk.cyan("📋 File splitting suggestion:"));
            console.log(splitSuggestion);

            // Directly return the suggestion instead of prompting
            return splitSuggestion;

        } catch (error) {
            console.error("Error generating file split suggestion");
            throw error;
        }
    },

    parseSplitSuggestion(suggestion) {
        const files = {};
        const fileRegex = /# (?:Original File|New File): (.+)\n([\s\S]+?)(?=\n# (?:Original File|New File)|$)/g;
        let match;

        while ((match = fileRegex.exec(suggestion)) !== null) {
            const [, fileName, content] = match;
            files[fileName.trim()] = content.trim();
        }

        return files;
    },

    async saveFiles(originalFilePath, files) {
        const originalDir = path.dirname(originalFilePath);

        for (const [fileName, content] of Object.entries(files)) {
            const filePath =
                fileName === path.basename(originalFilePath) ? originalFilePath : path.join(originalDir, fileName);
            await FileManager.write(filePath, this.cleanGeneratedCode(content));
            console.log(chalk.green(`✅ Saved file: ${filePath}`));
        }
    },

    async optimizeAndRefactorFile(filePath, projectStructure) {
        console.log(chalk.cyan(`🔄 Optimizing and refactoring ${filePath}...`));
        const fileContent = await FileManager.read(filePath);
        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);
        const languageConfig = CONFIG.languageConfigs[language];

        const prompt = PromptBuilder.buildOptimizeAndRefactorFilePrompt(
            filePath,
            fileContent,
            projectStructure,
            language,
            languageConfig.linter,
            languageConfig.formatter,
            languageConfig.packageManager
        );

        console.log("Optimizing and refactoring...");

        try {
            const response = await getResponse(prompt, undefined, undefined, DEFAULT_MAX_NEW_TOKENS);
            console.log("Optimization and refactoring completed");
            const optimizedCode = this.cleanGeneratedCode(response.content[0].text);
            await FileManager.write(filePath, optimizedCode);
            console.log(chalk.green(`✅ ${filePath} has been optimized and refactored.`));
            await this.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            console.error("Error optimizing and refactoring");
            throw error;
        }
    },

    getLanguageFromExtension(fileExtension) {
        for (const [language, config] of Object.entries(CONFIG.languageConfigs)) {
            if (config.fileExtensions.includes(fileExtension)) {
                return language;
            }
        }
        return "javascript";
    },

    async generateDependencyFile(language, projectStructure, readme) {
        const languageConfig = CONFIG.languageConfigs[language];
        let dependencyFileName;

        switch (languageConfig.packageManager) {
            case "npm":
                dependencyFileName = "package.json";
                break;
            case "pip":
                dependencyFileName = "requirements.txt";
                break;
            case "nuget":
                dependencyFileName = "ProjectName.csproj";
                break;
            case "maven":
                dependencyFileName = "pom.xml";
                break;
            case "bundler":
                dependencyFileName = "Gemfile";
                break;
            case "go mod":
                dependencyFileName = "go.mod";
                break;
            case "cargo":
                dependencyFileName = "Cargo.toml";
                break;
            case "composer":
                dependencyFileName = "composer.json";
                break;
            case "swift package manager":
                dependencyFileName = "Package.swift";
                break;
            case "gradle":
                dependencyFileName = "build.gradle";
                break;
            case "pub":
                dependencyFileName = "pubspec.yaml";
                break;
            default:
                console.log(chalk.red(`Unsupported package manager: ${languageConfig.packageManager}`));
                return;
        }

        console.log(chalk.cyan(`📦 Generating ${dependencyFileName} for ${language}...`));

        const prompt = `
Please generate a ${dependencyFileName} file for a ${language} project with the following structure:

${JSON.stringify(projectStructure, null, 2)}

README.md content:
${readme}

Include all necessary dependencies based on the project structure and features described in the README.md. Ensure the file is properly formatted and follows best practices for ${language} projects.

Return the content of the ${dependencyFileName} file without explanations or comments. Do not include any explanations or comments in your response, just provide the code.
`;

        console.log(`Generating ${dependencyFileName}...`);

        try {
            const response = await getResponse(prompt, undefined, undefined, DEFAULT_MAX_NEW_TOKENS);
            console.log(`${dependencyFileName} generated successfully`);
            const dependencyFileContent = this.cleanGeneratedCode(response.content[0].text);
            await FileManager.write(dependencyFileName, dependencyFileContent);
            console.log(chalk.green(`✅ Generated ${dependencyFileName}`));
            await this.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            console.error(`Error generating ${dependencyFileName}`);
            throw error;
        }
    },

    async generateAIAgentCode(agentType, agentDescription, projectStructure, readme) {
        console.log(chalk.cyan(`🤖 Generating AI agent code for ${agentType}...`));

        const fileManagerContent = await FileManager.read("fileManager.js");
        const userInterfaceContent = await FileManager.read("userInterface.js");
        const configContent = await FileManager.read("config.js");

        const prompt = `
Please generate code for the ${agentType} AI agent based on the project structure and features described in the README.md. The agent should be able to perform its specific tasks as outlined in the README.

Agent description: ${agentDescription}

README.md content:
${readme}

Project structure:
${JSON.stringify(projectStructure, null, 2)}

fileManager.js content:
${fileManagerContent}

userInterface.js content:
${userInterfaceContent}

config.js content:
${configContent}

Ensure the code is complete, functional, and follows best practices for JavaScript. Consider the project structure when implementing the agent's functionality. Reuse existing modules and avoid duplicating code.

Return the generated code for the ${agentType} AI agent without explanations or comments. Do not include any explanations or comments in your response, just provide the code.
`;

        console.log(`Generating ${agentType} AI agent code...`);

        try {
            const response = await getResponse(prompt, undefined, undefined, DEFAULT_MAX_NEW_TOKENS);
            console.log(`${agentType} AI agent code generated successfully`);
            const agentCode = this.cleanGeneratedCode(response.content[0].text);
            const fileName = `./${agentType.replace(/\s+/g, "")}.js`;
            await FileManager.write(fileName, agentCode);
            console.log(chalk.green(`✅ Generated ${fileName}`));
            await this.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            console.error(`Error generating ${agentType} AI agent code`);
            throw error;
        }
    },

    async generateLandingPage(projectStructure, readme) {
        console.log(chalk.cyan("🌐 Generating landing page..."));

        const prompt = `
Please generate an HTML file for a landing page based on the project structure and features described in the README.md. The landing page should showcase the key features of the project and provide a visually appealing introduction.

Project structure:
${JSON.stringify(projectStructure, null, 2)}

README.md content:
${readme}

Use the following design guidelines:
- Responsive and mobile-friendly design
- Highlight key features and project information
- Include sections for pricing tiers
- Use a sleek design and creativity

Return the generated HTML code for the landing page without explanations or comments.
`;

        console.log("Generating landing page...");

        try {
            const response = await getResponse(prompt, undefined, undefined, DEFAULT_MAX_NEW_TOKENS);
            console.log("Landing page generated successfully");
            const landingPageCode = this.cleanGeneratedCode(response.content[0].text);
            const fileName = "landing.html";
            await FileManager.write(fileName, landingPageCode);
            console.log(chalk.green(`✅ Generated ${fileName}`));
            await this.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            console.error("Error generating landing page");
            throw error;
        }
    },

    async generateFullProject(projectStructure, readme) {
        console.log(chalk.cyan("🚀 Generating full project..."));

        const { language } = await UserInterface.promptForLanguage();
        await this.generateDependencyFile(language, projectStructure, readme);

        const files = Object.keys(projectStructure).filter(
            (file) => !file.includes(CONFIG.languageConfigs[language].dependencyFile)
        );

        for (const file of files) {
            const fileExtension = path.extname(file);
            const fileLanguage = this.getLanguageFromExtension(fileExtension);
            const languageConfig = CONFIG.languageConfigs[fileLanguage];

            if (languageConfig) {
                const content = await this.generate(readme, "", file, projectStructure, {});
                await FileManager.write(file, content);
                console.log(chalk.green(`✅ Generated ${file}`));

                await CodeAnalyzer.runLintChecks(file);
                await DocumentationGenerator.generate(file, content, projectStructure);
            }
        }

        await this.createMissingSourceFile(projectStructure, readme);
        await this.generateLandingPage(projectStructure, readme);
        await DocumentationGenerator.generateProjectDocumentation(projectStructure);

        console.log(chalk.green("✅ Full project generated successfully"));
    },

    async createMissingSourceFile(projectStructure, readme) {
        console.log(chalk.cyan("🔍 Checking for missing source files..."));

        const sourceFiles = Object.keys(projectStructure).filter(
            (file) => file.endsWith(".js") && !file.startsWith("server/") && file !== "index.js"
        );

        if (sourceFiles.length === 0) {
            console.log(chalk.yellow("No source files found. Creating a new one..."));

            const fileName = "app.js";
            const prompt = `
Please generate code for a new source file named ${fileName} based on the project structure and features described in the README.md. This file should serve as the main application logic for the project.

README.md content:
${readme}

Project structure:
${JSON.stringify(projectStructure, null, 2)}

Ensure the code is complete, functional, and follows best practices for JavaScript. Consider the project structure when implementing the main application logic. Reuse existing modules and avoid duplicating code.

Return the generated code for ${fileName} without explanations or comments.
`;

            console.log(`Generating ${fileName}...`);

            try {
                const response = await getResponse(prompt, undefined, undefined, DEFAULT_MAX_NEW_TOKENS);
                console.log(`${fileName} generated successfully`);
                const sourceFileContent = this.cleanGeneratedCode(response.content[0].text);
                await FileManager.write(fileName, sourceFileContent);
                console.log(chalk.green(`✅ Generated ${fileName}`));
                projectStructure[fileName] = null;
                await this.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
            } catch (error) {
                console.error(`Error generating ${fileName}`);
                throw error;
            }
        } else {
            console.log(chalk.green("✅ Source files already exist. No need to create a new one."));
        }
    },

    async calculateTokenStats(inputTokens, outputTokens) {
        if (!inputTokens || !outputTokens) {
            return;
        }
        const inputCost = (inputTokens / 1000000) * 3;
        const outputCost = (outputTokens / 1000000) * 15;
        const totalCost = inputCost + outputCost;

        console.log(
            chalk.cyan(
                `📊 Token Statistics: Input: ${inputTokens}, Output: ${outputTokens}, Cost: ${chalk.yellow(
                    `$${totalCost.toFixed(2)}`
                )}`
            )
        );
    },

    async updateChangelog(changes) {
        const changelogPath = "CHANGELOG.md";
        let changelog = "";

        try {
            changelog = await fs.readFile(changelogPath, "utf-8");
        } catch {
            console.log(chalk.yellow("CHANGELOG.md not found. Creating a new one."));
        }

        const currentDate = new Date().toISOString().split("T")[0];
        const newEntry = `
## [Unreleased] - ${currentDate}

${changes.map((change) => `- ${change}`).join("\n")}

`;

        changelog = newEntry + changelog;

        await fs.writeFile(changelogPath, changelog);
        console.log(chalk.green("✅ CHANGELOG.md updated successfully"));
    },

    async createAppDescriptionFiles(projectStructure, readme) {
        console.log(chalk.cyan("📝 Creating app description and metadata files..."));

        const prompt = `
Please generate the following app description and metadata files for both Google Play Store and Apple App Store:

1. app_description.txt (max 4000 characters)
2. short_description.txt (max 80 characters)
3. keywords.txt (comma-separated, max 100 characters)
4. title.txt (max 30 characters)
5. subtitle.txt (max 30 characters)
6. privacy_policy.html
7. release_notes.txt

Base the content on the project's README.md and existing features. Ensure the descriptions are engaging and highlight the key features of the app.

README.md content:
${readme}

Project structure:
${JSON.stringify(projectStructure, null, 2)}


Return the content for each file in the following format:

# File: [filename]
[content]

# File: [filename]
[content]

...and so on for all files.
`;

        console.log("Generating app description and metadata files...");

        try {
            const response = await getResponse(prompt, undefined, undefined, DEFAULT_MAX_NEW_TOKENS);
            console.log("App description and metadata files generated successfully");

            const files = this.parseGeneratedFiles(response.content[0].text);
            for (const [fileName, content] of Object.entries(files)) {
                await FileManager.write(`docs/${fileName}`, content);
                console.log(chalk.green(`✅ Generated docs/${fileName}`));
            }

            await this.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            console.error("Error generating app description and metadata files");
            throw error;
        }
    },

    parseGeneratedFiles(content) {
        const files = {};
        const fileRegex = /# File: (.+)\n([\s\S]+?)(?=\n# File:|$)/g;
        let match;

        while ((match = fileRegex.exec(content)) !== null) {
            const [, fileName, fileContent] = match;
            files[fileName.trim()] = fileContent.trim();
        }

        return files;
    },
};

export default CodeGenerator;
