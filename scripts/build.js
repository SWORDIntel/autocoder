import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const filesToCopy = [
    "README.md",
    "package.json",
    "LICENSE.md",
    "index.js",
    "tui.js",
    "fileManager.js",
    "codeGenerator.js",
    "codeAnalyzer.js",
    "documentationGenerator.js",
    "logger.js",
    "model.js",
    "config.js",
    "inferenceServerManager.js",
    "modelDownloader.js",
    "settingsManager.js",
    "promptBuilder.js",
    "server/memoryManager.js",
    "server/models/memory.js",
    "server/routes/memories.js",
    "server/server.js",
    "hardware_analyzer.py",
    "openvino_inference_server.py",
    "requirements.txt"
];

async function build() {
    try {
        // Clean the dist directory
        if (fs.existsSync(distDir)) {
            fs.rmSync(distDir, { recursive: true, force: true });
        }
        fs.mkdirSync(distDir, { recursive: true });

        // Copy files
        for (const file of filesToCopy) {
            const src = path.join(rootDir, file);
            const dest = path.join(distDir, file);
            fs.copySync(src, dest);
        }

        // Copy server directory
        const serverSrc = path.join(rootDir, "server");
        const serverDest = path.join(distDir, "server");
        fs.copySync(serverSrc, serverDest, {
            filter: (src) => !src.includes("node_modules")
        });


        // Install production dependencies
        console.log("Installing production dependencies...");
        await new Promise((resolve, reject) => {
            exec("npm install --omit=dev", { cwd: distDir }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error installing dependencies: ${error}`);
                    reject(error);
                    return;
                }
                console.log(stdout);
                console.error(stderr);
                resolve();
            });
        });

        console.log("Build completed successfully!");
    } catch (error) {
        console.error(`Build failed: ${error}`);
        process.exit(1);
    }
}

build();