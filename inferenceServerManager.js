import * as child_process from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import path from 'path';

const execFileAsync = promisify(child_process.execFile);

class InferenceServerManager {
    constructor() {
        this.serverProcess = null;
    }

    async _analyzeHardware() {
        try {
            console.log(chalk.blue("🔎 Analyzing hardware for optimal performance..."));
            const analyzerPath = path.join(process.cwd(), 'hardware_analyzer.py');
            const { stdout } = await execFileAsync('python3', [analyzerPath, '--json']);
            const hardwareReport = JSON.parse(stdout);

            const deviceList = hardwareReport?.compiler_flags?.environment
                .find(e => e.startsWith('OPENVINO_HETERO_PRIORITY='))
                ?.split('=')[1] || 'CPU';

            const envVars = hardwareReport?.compiler_flags?.environment || [];

            const performanceEnv = envVars.reduce((acc, curr) => {
                const [key, value] = curr.split('=');
                if (key && value) {
                    acc[key] = value;
                }
                return acc;
            }, {});

            console.log(chalk.green(`✅ Hardware analysis complete. Prioritized devices: ${deviceList}`));
            return { deviceList, performanceEnv };
        } catch (error) {
            console.warn(chalk.yellow("⚠️ Hardware analysis failed. Falling back to default 'CPU' device."), error.message);
            return { deviceList: 'CPU', performanceEnv: {} };
        }
    }

    async start(modelPath) {
        if (this.serverProcess) {
            console.log(chalk.yellow("Inference server is already running."));
            return;
        }

        if (!modelPath) {
            const errorMsg = "Cannot start inference server: No model path provided. Please select a model first.";
            console.error(chalk.red(errorMsg));
            throw new Error(errorMsg);
        }

        const { deviceList, performanceEnv } = await this._analyzeHardware();

        return new Promise((resolve, reject) => {
            console.log(chalk.blue(`🚀 Starting local inference server for model: ${path.basename(modelPath)}...`));

            const serverPath = path.join(process.cwd(), 'openvino_inference_server.py');
            const serverArgs = [
                '--port', '5001',
                '--device', deviceList
            ];

            // Merge the performance environment variables with the current process environment
            const spawnEnv = { ...process.env, ...performanceEnv };

            this.serverProcess = child_process.spawn('python3', [serverPath, ...serverArgs], {
                stdio: ['ignore', 'pipe', 'pipe'],
                env: spawnEnv, // Pass the enhanced environment to the child process
            });

            this.serverProcess.stdout.on('data', (data) => {
                const output = data.toString().trim();
                console.log(chalk.gray(`[Server] ${output}`));
                if (output.includes("Starting OpenVINO server on")) {
                    console.log(chalk.green("✅ Inference server started successfully."));
                    resolve();
                }
            });

            this.serverProcess.stderr.on('data', (data) => {
                const errorOutput = data.toString().trim();
                console.error(chalk.red(`[Server Error] ${errorOutput}`));
                if (errorOutput.includes("Server cannot start")) {
                    this.serverProcess = null;
                    reject(new Error(errorOutput));
                }
            });

            this.serverProcess.on('close', (code) => {
                if (code !== 0 && code !== null) {
                    console.log(chalk.yellow(`Inference server exited with code ${code}`));
                }
                this.serverProcess = null;
            });

            this.serverProcess.on('error', (err) => {
                console.error(chalk.red('Failed to start server process.'), err);
                this.serverProcess = null;
                reject(err);
            });
        });
    }

    async stop() {
        if (this.serverProcess) {
            console.log(chalk.blue("🔌 Stopping inference server..."));
            return new Promise((resolve) => {
                this.serverProcess.on('close', () => {
                    console.log(chalk.green("✅ Server stopped."));
                    this.serverProcess = null;
                    resolve();
                });
                this.serverProcess.kill('SIGINT');
            });
        }
        return Promise.resolve();
    }
}

const inferenceServerManager = new InferenceServerManager();
export default inferenceServerManager;