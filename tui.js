import blessed from 'blessed';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import CodeAnalyzer from './codeAnalyzer.js';
import FileManager from './fileManager.js';
import CodeGenerator from './codeGenerator.js';
import DocumentationGenerator from './documentationGenerator.js';
import settingsManager from './settingsManager.js';
import modelDownloader from './modelDownloader.js';
import { CONFIG } from './config.js';
import logger from './logger.js';

class TUI {
    constructor() {
        this.screen = null;
        this.mainMenu = null;
        this.fileManager = null;
        this.logPanel = null;
        this.pendingFileAction = null;
        this.projectStructure = null;
        this.readme = null;
        this.readmePath = null;

        this.actions = [
            "📝 Brainstorm README.md", "🔧 Generate code", "🔍 Detect missing dependencies",
            "🚀 Run static code quality checks", "📚 Generate documentation", "🔄 Optimize and refactor file",
            "📚 Generate project documentation", "🤔 Analyze code quality", "🔍 Optimize project structure",
            "➕ Add new file", "🤖 Run AI Agents", "🔒 Security analysis",
            "🧪 Generate unit tests", "🚀 Analyze performance", "🌐 Generate landing page",
            "📊 Generate API documentation", "🔄 Generate full project", "🧠 Record a Memory",
            "🤖 Change model", "☁️ Download model", "📂 Split large file",
        ];
    }

    async init() {
        this.screen = blessed.screen({ smartCSR: true, title: 'AutoCode TUI (Local-Only)' });
        this.createLayout();
        this.setupEventHandlers();
        logger.setLogFunction(this.log.bind(this));
        logger.log("TUI Initialized in local-only mode.");
        this.readmePath = path.join(process.cwd(), "README.md");
        await this.refreshAll();
        this.screen.key(['escape', 'q', 'C-c'], () => process.exit(0));
        this.screen.render();
    }

    createLayout() {
        this.mainMenu = blessed.list({
            parent: this.screen, label: 'Main Menu',
            top: 1, left: 0, width: '25%', height: '50%-1',
            border: 'line', style: { fg: 'white', border: { fg: 'cyan' }, selected: { bg: 'blue' } },
            keys: true, mouse: true, vi: true,
        });

        this.fileManager = blessed.list({
            parent: this.screen, label: 'File Explorer',
            top: '50%', left: 0, width: '25%', height: '50%-1',
            border: 'line', style: { fg: 'white', border: { fg: 'cyan' }, selected: { bg: 'blue' } },
            keys: true, mouse: true, vi: true,
        });

        this.logPanel = blessed.log({
            parent: this.screen, label: 'Output',
            top: 1, left: '25%', width: '75%', height: '100%-2',
            border: 'line', style: { fg: 'white', border: { fg: 'cyan' } },
            scrollable: true, alwaysScroll: true,
            scrollbar: { ch: ' ', inverse: true },
            keys: true, mouse: true, vi: true,
        });

        this.mainMenu.focus();
    }

    setupEventHandlers() {
        this.mainMenu.on('select', (item) => {
            const action = item.getContent().trim().replace(/^{\w+}.*?{\/\w+}\s*\d+:\s*/, '');
            this.handleAction(action);
        });

        this.fileManager.on('select', (item) => {
            if (this.pendingFileAction) {
                const selectedFile = item.getContent().trim();
                this.executeAction(this.pendingFileAction, [selectedFile]);
                this.pendingFileAction = null;
                this.mainMenu.focus();
            } else {
                logger.log(`File selected (no action pending): ${item.getContent().trim()}`);
            }
        });
    }

    handleAction(action) {
        logger.log(`Action selected: '${action}'`);

        const needsFile = [
            "Generate code", "Run static code quality checks", "Generate documentation",
            "Optimize and refactor file", "Analyze code quality", "Security analysis",
            "Generate unit tests", "Analyze performance", "Record a Memory", "📂 Split large file",
        ];

        if (needsFile.includes(action)) {
            this.pendingFileAction = action;
            logger.log(`Please select a file for '${action}'`);
            this.fileManager.focus();
        } else {
            this.executeAction(action);
        }
    }

    async executeAction(action, files = []) {
        try {
            switch (action) {
                case "Brainstorm README.md":
                    await this.brainstormReadme();
                    break;
                case "Generate code":
                    await this.processFiles(files);
                    break;
                case "Detect missing dependencies":
                    logger.log("Detecting missing dependencies...");
                    await CodeAnalyzer.detectMissingDependencies(this.projectStructure);
                    break;
                case "Run static code quality checks":
                    for (const file of files) {
                        logger.log(`Running lint checks for ${file}...`);
                        const lintOutput = await CodeAnalyzer.runLintChecks(file);
                        if (lintOutput) {
                            logger.log(`Fixing lint errors for ${file}...`);
                            await CodeAnalyzer.fixLintErrors(file, lintOutput, this.projectStructure);
                        }
                    }
                    break;
                case "Generate documentation":
                     for (const file of files) {
                        logger.log(`Generating documentation for ${file}...`);
                        const content = await FileManager.read(file);
                        await DocumentationGenerator.generate(file, content, this.projectStructure);
                    }
                    break;
                case "Optimize and refactor file":
                    for (const file of files) {
                        logger.log(`Optimizing file ${file}...`);
                        await CodeGenerator.optimizeAndRefactorFile(file, this.projectStructure);
                    }
                    break;
                case "Generate project documentation":
                    logger.log("Generating project documentation...");
                    await DocumentationGenerator.generateProjectDocumentation(this.projectStructure);
                    logger.log("✅ Project documentation generated.");
                    break;
                case "Analyze code quality":
                    logger.log(`Analyzing code quality for ${files[0]}...`);
                    const result = await CodeAnalyzer.analyzeCodeQuality(files[0]);
                    logger.log(result.analysis);
                    logger.log(`Finished analysis for ${files[0]}.`);
                    break;
                case "Optimize project structure":
                    await CodeAnalyzer.optimizeProjectStructure(this.projectStructure);
                    break;
                case "Add new file":
                    await this.promptForNewFile();
                    break;
                case "Run AI Agents":
                    logger.log("AI Agents feature is not yet implemented.");
                    break;
                case "Security analysis":
                    for (const file of files) {
                        logger.log(`Analyzing security for ${file}...`);
                        await CodeAnalyzer.checkSecurityVulnerabilities(file);
                    }
                    break;
                case "Generate unit tests":
                    for (const file of files) {
                        logger.log(`Generating unit tests for ${file}...`);
                        await CodeAnalyzer.generateUnitTests(file, this.projectStructure);
                    }
                    break;
                case "Analyze performance":
                    for (const file of files) {
                        logger.log(`Analyzing performance for ${file}...`);
                        await CodeAnalyzer.analyzePerformance(file);
                    }
                    break;
                case "Generate landing page":
                    logger.log("Generating landing page...");
                    await CodeGenerator.generateLandingPage(this.projectStructure, this.readme);
                    logger.log("✅ Landing page generated.");
                    break;
                case "Generate API documentation":
                    logger.log("Generating API documentation...");
                    await DocumentationGenerator.generateAPIDocumentation(this.projectStructure, this.readme);
                    logger.log("✅ API documentation generated.");
                    break;
                case "Generate full project":
                    logger.log("Generating full project from README...");
                    await CodeGenerator.generateFullProject(this.projectStructure, this.readme);
                    logger.log("✅ Full project generation complete.");
                    break;
                case "Record a Memory":
                    await this.promptForMemory(files[0]);
                    break;
                case "Change model":
                    await this.promptForModel();
                    break;
                case "Download model":
                    await this.promptForModelDownload();
                    break;
                case "📂 Split large file": {
                    const filePath = files[0];
                    if (!filePath) break;

                    const content = await FileManager.read(filePath);
                    const lineCount = content.split('\n').length;

                    if (lineCount <= CONFIG.maxFileLines) {
                        logger.log(`File ${filePath} is under the line limit of ${CONFIG.maxFileLines}. No need to split.`);
                        break;
                    }

                    logger.log(`File ${filePath} has ${lineCount} lines, exceeding the limit of ${CONFIG.maxFileLines}. Generating split suggestion...`);
                    const splitSuggestion = await CodeGenerator.splitLargeFile(filePath, content, this.projectStructure);

                    if (splitSuggestion) {
                        await this.showDiffView(filePath, content, splitSuggestion);
                    } else {
                        logger.log("Could not generate a file split suggestion.");
                    }
                    break;
                }
                default:
                    logger.log(`Action '${action}' is not implemented.`);
                    break;
            }
        } catch(e) {
            logger.log(`ERROR during action '${action}': ${e.message}`);
            logger.error(e);
        }
    }

    async showDiffView(originalFilePath, originalFileContent, splitSuggestion) {
        const parsedFiles = CodeGenerator.parseSplitSuggestion(splitSuggestion);
        const newFileNames = Object.keys(parsedFiles);

        const container = blessed.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: '90%',
            height: '90%',
            label: ' File Split Suggestion - Review Changes ',
            border: { type: 'line' },
            style: { border: { fg: 'green' } },
            keys: true,
            vi: true,
        });

        blessed.box({
            parent: container,
            top: 1,
            left: 1,
            width: '50%-2',
            height: '100%-4',
            label: ` Original: ${originalFilePath} `,
            content: originalFileContent,
            border: { type: 'line' },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: { ch: ' ', inverse: true },
            keys: true,
            vi: true,
            mouse: true,
        });

        const rightPanel = blessed.box({
            parent: container,
            top: 1,
            right: 1,
            width: '50%-1',
            height: '100%-4',
            label: ' New Files ',
            border: { type: 'line' },
        });

        const newFilesList = blessed.list({
            parent: rightPanel,
            top: 1,
            left: 1,
            width: '100%-2',
            height: '30%',
            items: newFileNames,
            label: 'Select a file to view',
            border: { type: 'line' },
            style: { selected: { bg: 'blue' } },
            keys: true,
            vi: true,
            mouse: true,
        });

        const newFileContent = blessed.box({
            parent: rightPanel,
            top: '30%+1',
            left: 1,
            width: '100%-2',
            height: '70%-2',
            label: ' Content ',
            content: '',
            border: { type: 'line' },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: { ch: ' ', inverse: true },
            keys: true,
            vi: true,
            mouse: true,
        });

        newFilesList.on('select', (item) => {
            const fileName = item.getContent();
            newFileContent.setLabel(` Content: ${fileName} `);
            newFileContent.setContent(parsedFiles[fileName]);
            this.screen.render();
        });

        if (newFileNames.length > 0) {
            newFilesList.select(0);
            newFileContent.setLabel(` Content: ${newFileNames[0]} `);
            newFileContent.setContent(parsedFiles[newFileNames[0]]);
        }

        const applyButton = blessed.button({
            parent: container,
            mouse: true,
            keys: true,
            shrink: true,
            padding: { left: 1, right: 1 },
            right: 15,
            bottom: 1,
            name: 'apply',
            content: 'Apply',
            style: { focus: { bg: 'green' }, hover: { bg: 'green' } }
        });

        const cancelButton = blessed.button({
            parent: container,
            mouse: true,
            keys: true,
            shrink: true,
            padding: { left: 1, right: 1 },
            right: 2,
            bottom: 1,
            name: 'cancel',
            content: 'Cancel',
            style: { focus: { bg: 'red' }, hover: { bg: 'red' } }
        });

        applyButton.on('press', async () => {
            container.destroy();
            this.screen.render();
            logger.log("Applying file split...");
            try {
                await CodeGenerator.saveFiles(originalFilePath, parsedFiles);
                logger.log("✅ File split completed.");
                await this.refreshFileManager();
            } catch (e) {
                logger.log(`❌ Error applying file split: ${e.message}`);
            }
            this.mainMenu.focus();
        });

        cancelButton.on('press', () => {
            container.destroy();
            this.screen.render();
            logger.log("File split cancelled.");
            this.mainMenu.focus();
        });

        container.focus();
        this.screen.render();
    }

    async brainstormReadme() {
        logger.log("📝 Brainstorming README.md...");
        const updatedReadme = await CodeGenerator.updateReadme(this.readme, this.projectStructure);
        await FileManager.write(this.readmePath, updatedReadme);
        this.readme = updatedReadme;
        logger.log("✅ README.md updated successfully.");
    }

    async processFiles(files, readme, projectStructure) {
        const currentReadme = readme || this.readme;
        const currentProjectStructure = projectStructure || this.projectStructure;

        const allFileContents = {};
        for (const file of files) {
            allFileContents[path.join(process.cwd(), file)] = await FileManager.read(file);
        }

        for (const file of files) {
            logger.log(`Processing ${file}...`);
            const generatedContent = await CodeGenerator.generate(
                currentReadme,
                allFileContents[path.join(process.cwd(), file)],
                file,
                currentProjectStructure,
                allFileContents
            );
            await FileManager.write(file, generatedContent);
            logger.log(`✅ ${file} processed.`);
        }
    }

    async promptForNewFile() {
        const form = blessed.form({
            parent: this.screen, width: '50%', height: 5, top: 'center', left: 'center',
            border: 'line', label: ' Add New File (Press Enter to Create) ', keys: true,
        });

        const input = blessed.textbox({
            parent: form, name: 'fileName', top: 1, left: 2, height: 1, width: '90%',
            inputOnFocus: true, keys: true,
        });

        input.on('submit', async (fileName) => {
            form.destroy();
            this.mainMenu.focus();
            this.screen.render();

            if (fileName) {
                logger.log(`Creating file: ${fileName}`);
                await CodeAnalyzer.addNewFile(path.join(process.cwd(), fileName));
                logger.log(`Finished 'Add new file' action.`);
                await this.refreshFileManager();
            } else {
                logger.log("File creation cancelled (no filename).");
            }
        });

        input.focus();
        this.screen.render();
    }

    async promptForModelDownload() {
        const form = blessed.form({
            parent: this.screen,
            width: '60%',
            height: 5,
            top: 'center',
            left: 'center',
            border: 'line',
            label: ' Download Model from Hugging Face ',
            keys: true,
        });

        blessed.text({
            parent: form,
            top: 1,
            left: 2,
            content: 'Enter Model ID (e.g., Intel/neural-chat-7b-v3-1-int8-ov):',
        });

        const input = blessed.textbox({
            parent: form,
            name: 'modelId',
            top: 2,
            left: 2,
            height: 1,
            width: '95%',
            inputOnFocus: true,
            style: { focus: { bg: 'blue' } },
        });

        input.on('submit', async (modelId) => {
            form.destroy();
            this.mainMenu.focus();
            this.screen.render();

            if (modelId) {
                try {
                    await modelDownloader.download(modelId, this);
                } catch (error) {
                    logger.log(`❌ Error downloading model: ${error.message}`);
                }
            } else {
                logger.log('Model download cancelled.');
            }
        });

        input.focus();
        this.screen.render();
    }

    async promptForMemory(file) {
        if (!file) {
            logger.log("Error: promptForMemory was called without a file.");
            return;
        }

        const form = blessed.form({
            parent: this.screen, width: '60%', height: 10, top: 'center', left: 'center',
            border: 'line', label: ` Record Memory for ${file} `, keys: true,
        });

        blessed.text({ parent: form, top: 1, left: 2, content: 'Learnings:' });
        const learningsInput = blessed.textbox({
            parent: form, name: 'learnings', top: 2, left: 2, height: 1, width: '95%',
            inputOnFocus: true, style: { focus: { bg: 'blue' } }
        });

        blessed.text({ parent: form, top: 4, left: 2, content: 'Tags (comma-separated):' });
        const tagsInput = blessed.textbox({
            parent: form, name: 'tags', top: 5, left: 2, height: 1, width: '95%',
            inputOnFocus: true, style: { focus: { bg: 'blue' } }
        });

        const submit = blessed.button({
            parent: form, name: 'submit', content: 'Save Memory', top: 7, left: 2,
            shrink: true, style: { focus: { bg: 'blue' } }
        });

        submit.on('press', () => form.submit());

        form.on('submit', async (data) => {
            form.destroy();
            this.mainMenu.focus();
            this.screen.render();
            if (data.learnings) {
                const result = await CodeAnalyzer.recordMemory(file, data.learnings, data.tags);
                logger.log(result);
            } else {
                logger.log("⚠️ Learnings cannot be empty. Memory not saved.");
            }
        });

        learningsInput.focus();
        this.screen.render();
    }

    async promptForModel() {
        logger.log("Analyzing hardware for recommendations...");

        const analyzerPromise = new Promise((resolve, reject) => {
            const process = spawn('python3', ['hardware_analyzer.py', '--json']);
            let report = '';
            let errorOutput = '';
            process.stdout.on('data', (data) => report += data.toString());
            process.stderr.on('data', (data) => errorOutput += data.toString());
            process.on('close', (code) => {
                if (code !== 0) {
                    logger.log(`⚠️ Hardware analyzer exited with code ${code}. Recommendations may be unavailable.`);
                    logger.log(`Stderr: ${errorOutput}`);
                    resolve(null); // Resolve with null on error instead of rejecting
                } else {
                    try {
                        resolve(JSON.parse(report));
                    } catch (e) {
                        logger.log(`❌ Error parsing hardware analyzer output: ${e.message}`);
                        resolve(null);
                    }
                }
            });
             process.on('error', (err) => {
                logger.log(`❌ Failed to start hardware analyzer: ${err.message}`);
                resolve(null);
            });
        });

        const [hardwareReport, models] = await Promise.all([
            analyzerPromise,
            FileManager.discoverLocalModels()
        ]);

        logger.log("Discovering local models...");
        if (models.length === 0) {
            logger.log("No local models found in the 'models' directory.");
            logger.log("Please download models and place them in subdirectories inside the 'models' folder.");
            return;
        }

        let recommendedDevice = 'CPU'; // Default
        if (hardwareReport) {
            if (hardwareReport.npu && hardwareReport.npu.detected) {
                recommendedDevice = 'NPU';
            } else if (hardwareReport.gpu && hardwareReport.gpu.detected) {
                recommendedDevice = 'GPU';
            }
            logger.log(`Hardware analysis complete. Recommended device: ${recommendedDevice}`);
        }

        const modelNames = models.map(modelPath => {
            const modelName = path.basename(modelPath);
            const isRecommended = recommendedDevice !== 'CPU' && modelName.toLowerCase().includes(recommendedDevice.toLowerCase());
            return {
                name: modelName,
                path: modelPath,
                recommended: isRecommended
            };
        });

        modelNames.sort((a, b) => b.recommended - a.recommended);

        const listItems = modelNames.map(m => m.recommended ? `[✨ Recommended] ${m.name}` : m.name);

        const list = blessed.list({
            parent: this.screen,
            label: ' Select a Local Model ',
            width: '60%',
            height: '50%',
            top: 'center',
            left: 'center',
            border: 'line',
            items: listItems,
            keys: true,
            mouse: true,
            vi: true,
            style: { selected: { bg: 'blue' } },
        });

        list.on('select', async (item, select) => {
            const selectedModel = modelNames[select];
            await settingsManager.set('model', selectedModel.path);
            logger.log(`✅ Model set to ${selectedModel.name}`);
            list.destroy();
            this.screen.render();
        });

        list.focus();
        this.screen.render();
    }

    log(message) {
        if (this.logPanel) {
            this.logPanel.log(String(message));
        } else {
            console.log(String(message));
        }
    }

    async refreshAll() {
        await this.refreshFileManager();
        await this.refreshReadme();
        this.refreshMainMenu();
    }

    async refreshReadme() {
        try {
            this.readme = await FileManager.read(this.readmePath);
        } catch {
            logger.log(`Could not read README.md at ${this.readmePath}. Some features may not work.`);
            this.readme = "";
        }
    }

    async refreshFileManager() {
        this.projectStructure = await FileManager.getProjectStructure();
        const files = await FileManager.getFilesToProcess();
        this.fileManager.setItems(files);
        this.screen.render();
    }

    refreshMainMenu() {
        const menuItems = this.actions.map((action, index) => `{bold}${index + 1}{/bold}: ${action}`);
        this.mainMenu.setItems(menuItems);
        this.screen.render();
    }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    const tui = new TUI();
    tui.init();
}

export default TUI;