#!/usr/bin/env node

import path from "path";
import chalk from "chalk";
import chokidar from "chokidar";
import FileManager from "./fileManager.js";
import TUI from "./tui.js";
import CodeGenerator from "./codeGenerator.js";
import settingsManager from "./settingsManager.js";
import inferenceServerManager from "./inferenceServerManager.js";

const tui = new TUI();

export async function runWatchMode() {
    console.log(chalk.blue("👀 Running in watch mode..."));
    const readmePath = path.join(process.cwd(), "README.md");

    console.log(chalk.cyan(`Watching for changes in ${readmePath}...`));

    const watcher = chokidar.watch(readmePath, {
        persistent: true,
        ignoreInitial: true,
    });

    watcher.on('change', async (filePath) => {
        console.log(chalk.yellow(`\nFile changed: ${filePath}. Kicking off automated refactoring...`));
        try {
            const readme = await FileManager.read(readmePath);
            if (!readme) {
                console.error(chalk.red("❌ README.md not found or unable to read. Aborting this cycle."));
                return;
            }

            const projectStructure = await FileManager.getProjectStructure();
            const filesToProcess = await FileManager.getFilesToProcess();
            await tui.processFiles(filesToProcess, readme, projectStructure);

            console.log(chalk.green("✅ Automated refactoring complete. Watching for new changes..."));
        } catch (error) {
            console.error(chalk.red("❌ An error occurred during automated refactoring:"), error.message);
            console.log(chalk.yellow("Watching for new changes..."));
        }
    });

    if (process.env.JEST_WORKER_ID === undefined) {
        return new Promise(() => {});
    }
}

export async function runAutomatedMode() {
    try {
        console.log(chalk.blue("🚀 Running in local-only automated mode..."));
        const readmePath = path.join(process.cwd(), "README.md");
        let readme = await FileManager.read(readmePath);
        if (!readme) {
            console.error(chalk.red("❌ README.md not found or unable to read."));
            process.exit(1);
        }

        console.log(chalk.cyan("📝 Brainstorming README.md..."));
        const projectStructure = await FileManager.getProjectStructure();
        // No longer passing model or apiKey, as they are handled by the new local-only system
        const updatedReadme = await CodeGenerator.updateReadme(readme, projectStructure);
        await FileManager.write(readmePath, updatedReadme);
        readme = updatedReadme;
        console.log(chalk.green("✅ README.md brainstorming complete."));

        console.log(chalk.cyan("🔧 Generating code for all files..."));
        const filesToProcess = await FileManager.getFilesToProcess();
        await tui.processFiles(filesToProcess, readme, projectStructure);
        console.log(chalk.green("✅ Code generation for all files complete."));

        console.log(chalk.green("🎉 Automated mode completed successfully!"));
        // The shutdown hook will handle stopping the server.
        process.exit(0);
    } catch (error) {
        console.error(chalk.red("❌ Error occurred in automated mode:"), error.message);
        process.exit(1);
    }
}

export async function main() {
    await settingsManager.load();
    const modelPath = settingsManager.get('model');

    if (modelPath) {
        try {
            await inferenceServerManager.start(modelPath);
        } catch (error) {
            console.error(chalk.red('Failed to start inference server with the selected model. It may be invalid or missing.'), error.message);
        }
    } else {
        console.log(chalk.yellow("No local model selected. Code generation will be unavailable. Please select a model via the 'Change model' option."));
    }

    const args = process.argv.slice(2);

    if (args.includes("--watch")) {
        await runWatchMode();
        return;
    }

    // Updated argument parsing for the new local-only automated mode.
    if (args.includes("--generate")) {
        await runAutomatedMode();
        return;
    }

    await tui.init();
    if (process.env.JEST_WORKER_ID === undefined) {
        return new Promise(() => {});
    }
}

// This block handles the main execution and graceful shutdown.
if (process.env.JEST_WORKER_ID === undefined) {
    const shutdown = async (error) => {
        console.log(chalk.blue("\nGracefully shutting down..."));
        if (error && error.message) {
            console.error(chalk.red("❌ An error occurred:"), error.message);
        }
        if (tui.screen && !tui.screen.destroyed) {
            tui.screen.destroy();
        }
        await inferenceServerManager.stop();
        process.exit(error ? 1 : 0);
    };

    // Set up listeners for shutdown signals
    process.on('uncaughtException', shutdown);
    process.on('unhandledRejection', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Run the main application
    main().catch(shutdown);
}