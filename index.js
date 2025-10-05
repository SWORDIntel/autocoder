#!/usr/bin/env node

import path from "path";
import chalk from "chalk";

import FileManager from "./fileManager.js";
import TUI from "./tui.js";
import CodeGenerator from "./codeGenerator.js";

const tui = new TUI();

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