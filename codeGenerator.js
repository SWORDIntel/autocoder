import Anthropic from "@anthropic-ai/sdk";
import { CONFIG } from "./config.js";
import chalk from "chalk";
import inquirer from "inquirer";
import path from "path";
import FileManager from "./fileManager.js";
import ora from "ora";
import CodeAnalyzer from "./codeAnalyzer.js";
import DocumentationGenerator from "./documentationGenerator.js";
import UserInterface from "./userInterface.js";

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_KEY });

const CodeGenerator = {
    async generate(readme, currentCode, fileName, projectStructure, allFileContents) {
        const fileExtension = path.extname(fileName);
        const language = this.getLanguageFromExtension(fileExtension);
        const languageConfig = CONFIG.languageConfigs[language];

        const prompt = `
You are AutoCode, an automatic coding tool. Your task is to generate or update the ${fileName} file based on the README.md instructions, the current ${fileName} content (if any), the project structure, and the content of all other files.

README.md content:
${readme}

Current ${fileName} content (if exists):
${currentCode || "No existing code"}

Project structure:
${JSON.stringify(projectStructure, null, 2)}

Content of other selected files:
${Object.entries(allFileContents)
    .filter(([key]) => key !== fileName)
    .map(([key, value]) => `${key}:\n${value}`)
    .join("\n\n")}

Language: ${language}
File extension: ${fileExtension}
Linter: ${languageConfig.linter}
Formatter: ${languageConfig.formatter}
Package manager: ${languageConfig.packageManager}

Please generate or update the ${fileName} file to implement the features described in the README. Ensure the code is complete, functional, and follows best practices for ${language}. Consider the project structure and the content of other selected files when making changes or adding new features. Reuse functionality from other modules and avoid duplicating code. Do not include any explanations or comments in your response, just provide the code.
`;

        const spinner = ora("Generating code...").start();

        try {
            const response = await anthropic.messages.create({
                model: CONFIG.anthropicModel,
                max_tokens: CONFIG.maxTokens,
                temperature: await UserInterface.getTemperature(),
                messages: [{ role: "user", content: prompt }],
            });
            spinner.succeed("Code generated successfully");
            const generatedCode = response.content[0].text;
            await CodeGenerator.calculateTokenStats(response.usage.input_tokens, response.usage.output_tokens);
            return generatedCode;
        } catch (error) {
            spinner.fail("Error generating code");
            throw error;
        }
    },

    async updateReadme(readme, projectStructure) {
        const prompt = `
You are AutoCode, an automatic coding tool. Your task is to update the README.md file with new design ideas and considerations based on the current content and project structure.

Current README.md content:
${readme}

Project structure:
${JSON.stringify(projectStructure, null, 2)}

Please update the README.md file with new design ideas and considerations. Ensure the content is well-structured and follows best practices. Consider the current project structure when suggesting improvements or new features. Include information about multi-language support and any new features or changes. Do not include any explanations or comments in your response, just provide the updated README.md content.
`;

        const spinner = ora("Updating README...").start();

        try {
            const response = await anthropic.messages.create({
                model: CONFIG.anthropicModel,
                max_tokens: CONFIG.maxTokens,
                temperature: await UserInterface.getTemperature(),
                messages: [{ role: "user", content: prompt }],
            });
            spinner.succeed("README updated successfully");
            const updatedReadme = response.content[0].text;
            await CodeGenerator.calculateTokenStats(response.usage.input_tokens, response.usage.output_tokens);
            return updatedReadme;
        } catch (error) {
            spinner.fail("Error updating README");
            throw error;
        }
    },

    async splitLargeFile(filePath, content, projectStructure) {
        console.log(chalk.yellow(`📂 File ${filePath} exceeds ${CONFIG.maxFileLines} lines. Splitting...`));

        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);

        const prompt = `
The file ${filePath} exceeds ${
            CONFIG.maxFileLines
        } lines. Please suggest how to split this file into smaller, more manageable parts. Consider the following:

1. Identify logical components or functionalities that can be separated.
2. Suggest new file names for the extracted parts.
3. Provide the content for each new file, including the updated content for the original file.
4. Ensure that the split maintains the overall functionality and doesn't break any dependencies.
5. Use appropriate language-specific conventions for ${language}.

Current file content:
${content}

Project structure:
${JSON.stringify(projectStructure, null, 2)}

Please provide your suggestions in the following Markdown format:

# Original File: [original_file_name]
[content for the original file]

# New File: [new_file_name_1]
[content for new_file_1]

# New File: [new_file_name_2]
[content for new_file_2]

... (repeat for all new files)
`;

        const spinner = ora("Generating file split suggestion...").start();

        try {
            const response = await anthropic.messages.create({
                model: CONFIG.anthropicModel,
                max_tokens: CONFIG.maxTokens,
                temperature: await UserInterface.getTemperature(),
                messages: [{ role: "user", content: prompt }],
            });
            spinner.succeed("File split suggestion generated");
            const splitSuggestion = response.content[0].text;
            console.log(chalk.cyan("📋 File splitting suggestion:"));
            console.log(splitSuggestion);

            const { confirmSplit } = await inquirer.prompt({
                type: "confirm",
                name: "confirmSplit",
                message: "Do you want to proceed with the suggested file split?",
                default: true,
            });

            if (confirmSplit) {
                const files = this.parseSplitSuggestion(splitSuggestion);
                await this.saveFiles(filePath, files);
                console.log(chalk.green("✅ File split completed."));
            } else {
                console.log(chalk.yellow("⏹️ File split cancelled."));
            }

            await CodeGenerator.calculateTokenStats(response.usage.input_tokens, response.usage.output_tokens);
        } catch (error) {
            spinner.fail("Error generating file split suggestion");
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
            await FileManager.write(filePath, content);
            console.log(chalk.green(`✅ Saved file: ${filePath}`));
        }
    },

    async optimizeAndRefactorFile(filePath, projectStructure) {
        console.log(chalk.cyan(`🔄 Optimizing and refactoring ${filePath}...`));
        const fileContent = await FileManager.read(filePath);
        const fileExtension = path.extname(filePath);
        const language = this.getLanguageFromExtension(fileExtension);
        const languageConfig = CONFIG.languageConfigs[language];

        const prompt = `
Please optimize and refactor the following code from ${filePath}:

${fileContent}

Project structure:
${JSON.stringify(projectStructure, null, 2)}

Language: ${language}
File extension: ${fileExtension}
Linter: ${languageConfig.linter}
Formatter: ${languageConfig.formatter}
Package manager: ${languageConfig.packageManager}

Focus on:
1. Improving code efficiency
2. Enhancing readability
3. Applying design patterns where appropriate
4. Reducing code duplication
5. Improving overall code structure
6. Ensuring consistency with the project structure
7. Reusing functionality from other modules
8. Following best practices and conventions for ${language}

Return the optimized and refactored code ONLY!! without explanations or comments or md formatting. Do not include any explanations or comments in your response, just provide the code.
`;

        const spinner = ora("Optimizing and refactoring...").start();

        try {
            const response = await anthropic.messages.create({
                model: CONFIG.anthropicModel,
                max_tokens: CONFIG.maxTokens,
                temperature: await UserInterface.getTemperature(),
                messages: [{ role: "user", content: prompt }],
            });
            spinner.succeed("Optimization and refactoring completed");
            const optimizedCode = response.content[0].text;
            await FileManager.write(filePath, optimizedCode);
            console.log(chalk.green(`✅ ${filePath} has been optimized and refactored.`));
            await CodeGenerator.calculateTokenStats(response.usage.input_tokens, response.usage.output_tokens);
        } catch (error) {
            spinner.fail("Error optimizing and refactoring");
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

        const spinner = ora(`Generating ${dependencyFileName}...`).start();

        try {
            const response = await anthropic.messages.create({
                model: CONFIG.anthropicModel,
                max_tokens: CONFIG.maxTokens,
                temperature: await UserInterface.getTemperature(),
                messages: [{ role: "user", content: prompt }],
            });
            spinner.succeed(`${dependencyFileName} generated successfully`);
            const dependencyFileContent = response.content[0].text;
            await FileManager.write(dependencyFileName, dependencyFileContent);
            console.log(chalk.green(`✅ Generated ${dependencyFileName}`));
            await CodeGenerator.calculateTokenStats(response.usage.input_tokens, response.usage.output_tokens);
        } catch (error) {
            spinner.fail(`Error generating ${dependencyFileName}`);
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

        const spinner = ora(`Generating ${agentType} AI agent code...`).start();

        try {
            const response = await anthropic.messages.create({
                model: CONFIG.anthropicModel,
                max_tokens: CONFIG.maxTokens,
                temperature: await UserInterface.getTemperature(),
                messages: [{ role: "user", content: prompt }],
            });
            spinner.succeed(`${agentType} AI agent code generated successfully`);
            const agentCode = response.content[0].text;
            const fileName = `./agents/${agentType.replace(/\s+/g, "")}.js`;
            await FileManager.write(fileName, agentCode);
            console.log(chalk.green(`✅ Generated ${fileName}`));
            await CodeGenerator.calculateTokenStats(response.usage.input_tokens, response.usage.output_tokens);
        } catch (error) {
            spinner.fail(`Error generating ${agentType} AI agent code`);
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

        const spinner = ora("Generating landing page...").start();

        try {
            const response = await anthropic.messages.create({
                model: CONFIG.anthropicModel,
                max_tokens: CONFIG.maxTokens,
                temperature: await UserInterface.getTemperature(),
                messages: [{ role: "user", content: prompt }],
            });
            spinner.succeed("Landing page generated successfully");
            const landingPageCode = response.content[0].text;
            const fileName = "landing.html";
            await FileManager.write(fileName, landingPageCode);
            console.log(chalk.green(`✅ Generated ${fileName}`));
            await CodeGenerator.calculateTokenStats(response.usage.input_tokens, response.usage.output_tokens);
        } catch (error) {
            spinner.fail("Error generating landing page");
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

            const spinner = ora(`Generating ${fileName}...`).start();

            try {
                const response = await anthropic.messages.create({
                    model: CONFIG.anthropicModel,
                    max_tokens: CONFIG.maxTokens,
                    temperature: await UserInterface.getTemperature(),
                    messages: [{ role: "user", content: prompt }],
                });
                spinner.succeed(`${fileName} generated successfully`);
                const sourceFileContent = response.content[0].text;
                await FileManager.write(fileName, sourceFileContent);
                console.log(chalk.green(`✅ Generated ${fileName}`));
                projectStructure[fileName] = null;
                await CodeGenerator.calculateTokenStats(response.usage.input_tokens, response.usage.output_tokens);
            } catch (error) {
                spinner.fail(`Error generating ${fileName}`);
                throw error;
            }
        } else {
            console.log(chalk.green("✅ Source files already exist. No need to create a new one."));
        }
    },

    async calculateTokenStats(inputTokens, outputTokens) {
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
};

export default CodeGenerator;
