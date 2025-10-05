#!/usr/bin/env node

import path from "path";
import chalk from "chalk";
import chokidar from "chokidar";

import FileManager from "./fileManager.js";
import TUI from "./tui.js";
import CodeGenerator from "./codeGenerator.js";

const tui = new TUI();

async function runWatchMode() {
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
            // Corrected to use the 'tui' instance
            await tui.processFiles(filesToProcess, readme, projectStructure);

            console.log(chalk.green("✅ Automated refactoring complete. Watching for new changes..."));
        } catch (error) {
            console.error(chalk.red("❌ An error occurred during automated refactoring:"), error.message);
            console.log(chalk.yellow("Watching for new changes..."));
        }
    });

    return new Promise(() => {});
}

async function runAutomatedMode(model, apiKey) {
    try {
        console.log(chalk.blue("🚀 Running in automated mode..."));
        const readmePath = path.join(process.cwd(), "README.md");
        let readme = await FileManager.read(readmePath);
        if (!readme) {
            console.error(chalk.red("❌ README.md not found or unable to read."));
            process.exit(1);
        }

        console.log(chalk.cyan("📝 Brainstorming README.md..."));
        const projectStructure = await FileManager.getProjectStructure();
        const updatedReadme = await CodeGenerator.updateReadme(readme, projectStructure, model, apiKey);
        await FileManager.write(readmePath, updatedReadme);
        readme = updatedReadme;
        console.log(chalk.green("✅ README.md brainstorming complete."));

        console.log(chalk.cyan("🔧 Generating code for all files..."));
        const filesToProcess = await FileManager.getFilesToProcess();
        await tui.processFiles(filesToProcess, readme, projectStructure, model, apiKey);
        console.log(chalk.green("✅ Code generation for all files complete."));

        console.log(chalk.green("🎉 Automated mode completed successfully!"));
        process.exit(0);
    } catch (error) {
        console.error(chalk.red("❌ Error occured:"), error.message);
        process.exit(1);
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes("--watch")) {
        await runWatchMode();
        return;
    }

    if (args.length === 3 && args[0] === "generate") {
        const model = args[1];
        const apiKey = args[2];
        await runAutomatedMode(model, apiKey);
        return; // Exit after automated run
    }

    // Start the TUI by default
    await tui.init();
    // Keep the process alive for the TUI
    return new Promise(() => {});
}

main().catch((error) => {
    // Ensure the screen is restored on crash
    if (tui.screen) {
        tui.screen.destroy();
    }
    console.error(chalk.red("❌ An error occurred:"), error);
    process.exit(1);
});