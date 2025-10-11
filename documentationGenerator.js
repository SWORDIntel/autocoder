import path from "path";
import FileManager from "./fileManager.js";
import CodeGenerator from "./codeGenerator.js";
import { getResponse } from "./model.js";
import logger from "./logger.js";
import PromptBuilder from "./promptBuilder.js";

const DocumentationGenerator = {
    async generate(filePath, content, projectStructure) {
        logger.log(`📝 Generating documentation for ${filePath}...`);
        const docFilePath = path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}.md`);

        const promptBuilder = new PromptBuilder()
            .setTask("Generate documentation for the following code file:")
            .addSection("File", filePath)
            .addSection("Content", content)
            .addSection("Project structure", JSON.stringify(projectStructure, null, 2))
            .setInstructions(
                "Please provide comprehensive documentation for the code above. Include an overview, function/method descriptions, parameters, return values, and usage examples where applicable. Consider the project structure when describing the file's role in the overall project. Format the documentation in Markdown."
            );

        logger.startSpinner("Generating documentation...");
        try {
            const response = await getResponse(promptBuilder.build());
            logger.stopSpinner(true, "Documentation generated");
            await FileManager.write(docFilePath, CodeGenerator.cleanGeneratedCode(response.content[0].text));
            logger.log(`✅ Documentation generated for ${filePath}`);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            logger.stopSpinner(false, `Error generating documentation for ${filePath}`);
            logger.error(error.message, error);
        }
    },

    async generateProjectDocumentation(projectStructure) {
        logger.log("📚 Generating project-wide documentation...");
        const readmeContent = await FileManager.read("README.md");
        const filesContent = await this.getFilesContent(projectStructure);

        const promptBuilder = new PromptBuilder()
            .setTask("Generate comprehensive project documentation based on the following information:")
            .addSection("README.md content", readmeContent)
            .addSection("Project structure and file contents", JSON.stringify(filesContent, null, 2))
            .setInstructions(
                "Please provide a detailed project overview, architecture description, module interactions, and usage instructions. Include information about the project's features, installation, and any other relevant details. Format the documentation in Markdown."
            );

        logger.startSpinner("Generating project documentation...");
        try {
            const response = await getResponse(promptBuilder.build());
            logger.stopSpinner(true, "Project documentation generated");
            await FileManager.write("DOCUMENTATION.md", CodeGenerator.cleanGeneratedCode(response.content[0].text));
            logger.log("✅ Project documentation generated");
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            logger.stopSpinner(false, "Error generating project documentation");
            logger.error(error.message, error);
        }
    },

    async getFilesContent(projectStructure) {
        const filesContent = {};
        for (const [filePath, content] of Object.entries(projectStructure)) {
            if (content === null) {
                filesContent[filePath] = await FileManager.read(filePath);
            } else {
                filesContent[filePath] = content;
            }
        }
        return filesContent;
    },

    async generateUnitTestDocumentation(filePath, testContent) {
        logger.log(`📝 Generating unit test documentation for ${filePath}...`);
        const docFilePath = path.join(
            path.dirname(filePath),
            `${path.basename(filePath, path.extname(filePath))}_tests.md`
        );

        const promptBuilder = new PromptBuilder()
            .setTask("Generate documentation for the following unit test file:")
            .addSection("File", filePath)
            .addSection("Content", testContent)
            .setInstructions(
                "Please provide comprehensive documentation for the unit tests above. Include an overview of the test suite, descriptions of individual test cases, and any setup or teardown procedures. Format the documentation in Markdown."
            );

        logger.startSpinner("Generating unit test documentation...");
        try {
            const response = await getResponse(promptBuilder.build());
            logger.stopSpinner(true, "Unit test documentation generated");
            await FileManager.write(docFilePath, response.content[0].text);
            logger.log(`✅ Unit test documentation generated for ${filePath}`);
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            logger.stopSpinner(false, `Error generating unit test documentation for ${filePath}`);
            logger.error(error.message, error);
        }
    },

    async generateAPIDocumentation(projectStructure, readme) {
        logger.log("📚 Generating API documentation...");
        const apiFiles = Object.keys(projectStructure).filter(
            (file) => file.includes("routes") || file.includes("controllers")
        );
        const apiContents = await Promise.all(apiFiles.map((file) => FileManager.read(file)));

        const promptBuilder = new PromptBuilder()
            .setTask("Generate comprehensive API documentation based on README.md and the following API-related files:")
            .addSection(
                "API Files",
                apiFiles.map((file, index) => `${file}:\n${apiContents[index]}`).join("\n\n")
            )
            .addSection("README.md content", readme)
            .setInstructions(
                `Please provide detailed documentation for each API endpoint, including:
1. Endpoint URL
2. HTTP method
3. Request parameters
4. Request body (if applicable)
5. Response format
6. Response codes
7. Authentication requirements (if any)
8. Rate limiting information (if applicable)

Format the documentation in Markdown, suitable for inclusion in a README or separate API documentation file.`
            );

        logger.startSpinner("Generating API documentation...");
        try {
            const response = await getResponse(promptBuilder.build());
            logger.stopSpinner(true, "API documentation generated");
            await FileManager.write("API_DOCUMENTATION.md", response.content[0].text);
            logger.log("✅ API documentation generated");
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            logger.stopSpinner(false, "Error generating API documentation");
            logger.error(error.message, error);
        }
    },

    async generateChangeLog(commitMessages) {
        logger.log("📝 Generating change log...");

        const promptBuilder = new PromptBuilder()
            .setTask("Generate a change log based on the following commit messages:")
            .addSection("Commit Messages", commitMessages.join("\n"))
            .setInstructions(
                `Please categorize the changes into:
1. New features
2. Bug fixes
3. Improvements
4. Breaking changes (if any)

Format the change log in Markdown, suitable for inclusion in a CHANGELOG.md file.`
            );

        logger.startSpinner("Generating change log...");
        try {
            const response = await getResponse(promptBuilder.build());
            logger.stopSpinner(true, "Change log generated");
            await FileManager.write("CHANGELOG.md", response.content[0].text);
            logger.log("✅ Change log generated");
            await CodeGenerator.calculateTokenStats(response.usage?.input_tokens, response.usage?.output_tokens);
        } catch (error) {
            logger.stopSpinner(false, "Error generating change log");
            logger.error(error.message, error);
        }
    },
};

export default DocumentationGenerator;