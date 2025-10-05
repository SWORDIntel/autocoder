import blessed from 'blessed';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import CodeAnalyzer from './codeAnalyzer.js';
import FileManager from './fileManager.js';
import CodeGenerator from './codeGenerator.js';
import DocumentationGenerator from './documentationGenerator.js';

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
            "📊 Generate API documentation", "🔄 Generate full project", "🧠 Record a Memory", "🤖 Change model",
        ];
    }

    async init() {
        this.screen = blessed.screen({ smartCSR: true, title: 'AutoCode TUI (Isolated Dev)' });
        this.createLayout();
        this.setupEventHandlers();
        this.log("TUI Initialized in isolation.");
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
                this.log(`File selected (no action pending): ${item.getContent().trim()}`);
            }
        });
    }

    handleAction(action) {
        this.log(`Action selected: '${action}'`);

        const needsFile = [
            "Generate code", "Run static code quality checks", "Generate documentation",
            "Optimize and refactor file", "Analyze code quality", "Security analysis",
            "Generate unit tests", "Analyze performance", "Record a Memory",
        ];

        if (needsFile.includes(action)) {
            this.pendingFileAction = action;
            this.log(`Please select a file for '${action}'`);
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
                    this.log("Detecting missing dependencies...");
                    await CodeAnalyzer.detectMissingDependencies(this.projectStructure, this);
                    break;
                case "Run static code quality checks":
                    for (const file of files) {
                        this.log(`Running lint checks for ${file}...`);
                        const lintOutput = await CodeAnalyzer.runLintChecks(file, this);
                        if (lintOutput) {
                            this.log(`Fixing lint errors for ${file}...`);
                            await CodeAnalyzer.fixLintErrors(file, lintOutput, this.projectStructure, this);
                        }
                    }
                    break;
                case "Generate documentation":
                     for (const file of files) {
                        this.log(`Generating documentation for ${file}...`);
                        const content = await FileManager.read(file);
                        await DocumentationGenerator.generate(file, content, this.projectStructure);
                    }
                    break;
                case "Optimize and refactor file":
                    for (const file of files) {
                        this.log(`Optimizing file ${file}...`);
                        await CodeGenerator.optimizeAndRefactorFile(file, this.projectStructure);
                    }
                    break;
                case "Generate project documentation":
                    this.log("Generating project documentation...");
                    await DocumentationGenerator.generateProjectDocumentation(this.projectStructure);
                    this.log("✅ Project documentation generated.");
                    break;
                case "Analyze code quality":
                    this.log(`Analyzing code quality for ${files[0]}...`);
                    const result = await CodeAnalyzer.analyzeCodeQuality(files[0]);
                    this.log(result.analysis);
                    this.log(`Finished analysis for ${files[0]}.`);
                    break;
                case "Optimize project structure":
                    await CodeAnalyzer.optimizeProjectStructure(this.projectStructure, this);
                    break;
                case "Add new file":
                    await this.promptForNewFile();
                    break;
                case "Run AI Agents":
                    this.log("AI Agents feature is not yet implemented.");
                    break;
                case "Security analysis":
                    for (const file of files) {
                        this.log(`Analyzing security for ${file}...`);
                        await CodeAnalyzer.checkSecurityVulnerabilities(file);
                    }
                    break;
                case "Generate unit tests":
                    for (const file of files) {
                        this.log(`Generating unit tests for ${file}...`);
                        await CodeAnalyzer.generateUnitTests(file, this.projectStructure);
                    }
                    break;
                case "Analyze performance":
                    for (const file of files) {
                        this.log(`Analyzing performance for ${file}...`);
                        await CodeAnalyzer.analyzePerformance(file);
                    }
                    break;
                case "Generate landing page":
                    this.log("Generating landing page...");
                    await CodeGenerator.generateLandingPage(this.projectStructure, this.readme);
                    this.log("✅ Landing page generated.");
                    break;
                case "Generate API documentation":
                    this.log("Generating API documentation...");
                    await DocumentationGenerator.generateAPIDocumentation(this.projectStructure, this.readme);
                    this.log("✅ API documentation generated.");
                    break;
                case "Generate full project":
                    this.log("Generating full project from README...");
                    await CodeGenerator.generateFullProject(this.projectStructure, this.readme);
                    this.log("✅ Full project generation complete.");
                    break;
                case "Record a Memory":
                    await this.promptForMemory(files[0]);
                    break;
                case "Change model":
                    await this.promptForModel();
                    break;
                default:
                    this.log(`Action '${action}' is not implemented.`);
                    break;
            }
        } catch(e) {
            this.log(`ERROR during action '${action}': ${e.message}`);
            console.error(e);
        }
    }

    async brainstormReadme() {
        this.log("📝 Brainstorming README.md...");
        const updatedReadme = await CodeGenerator.updateReadme(this.readme, this.projectStructure);
        await FileManager.write(this.readmePath, updatedReadme);
        this.readme = updatedReadme;
        this.log("✅ README.md updated successfully.");
    }

    async processFiles(files) {
        const allFileContents = {};
        for (const file of files) {
            allFileContents[path.join(process.cwd(), file)] = await FileManager.read(file);
        }

        for (const file of files) {
            this.log(`Processing ${file}...`);
            const generatedContent = await CodeGenerator.generate(
                this.readme, allFileContents[path.join(process.cwd(), file)], file,
                this.projectStructure, allFileContents
            );
            await FileManager.write(file, generatedContent);
            this.log(`✅ ${file} processed.`);
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
                this.log(`Creating file: ${fileName}`);
                await CodeAnalyzer.addNewFile(path.join(process.cwd(), fileName), this);
                this.log(`Finished 'Add new file' action.`);
                await this.refreshFileManager();
            } else {
                this.log("File creation cancelled (no filename).");
            }
        });

        input.focus();
        this.screen.render();
    }

    async promptForMemory(file) {
        if (!file) {
            this.log("Error: promptForMemory was called without a file.");
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
                this.log(result);
            } else {
                this.log("⚠️ Learnings cannot be empty. Memory not saved.");
            }
        });

        learningsInput.focus();
        this.screen.render();
    }

    async promptForModel() {
        const models = [
            "claude-sonnet-4-20250514", "o3-mini", "o4-mini", "gemini-2.0-flash-thinking-exp-01-21",
            "gemini-2.5-flash-preview-05-20", "gemini-2.5-pro-preview-06-05"
        ];

        const list = blessed.list({
            parent: this.screen, label: ' Select a Model ',
            width: '50%', height: '50%', top: 'center', left: 'center',
            border: 'line', items: models, keys: true, mouse: true, vi: true,
            style: { selected: { bg: 'blue' } }
        });

        list.on('select', async (item) => {
            const model = item.getContent();
            await this.setModel(model);
            list.destroy();
            this.screen.render();
        });

        list.focus();
        this.screen.render();
    }

    async setModel(model) {
        try {
            const settingsPath = path.join(os.homedir(), ".settings.json");
            let settings = {};
            try {
                const currentSettings = await fs.readFile(settingsPath, "utf8");
                settings = JSON.parse(currentSettings);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    this.log(`⚠️  Could not read settings file: ${error.message}`);
                }
            }
            settings.model = model;
            await FileManager.write(settingsPath, JSON.stringify(settings, null, 2));
            this.log(`✅ Model set to ${model}`);
        } catch (error) {
            this.log(`❌ Error setting model: ${error.message}`);
        }
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
        } catch (e) {
            this.log(`Could not read README.md at ${this.readmePath}. Some features may not work.`);
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