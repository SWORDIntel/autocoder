import axios from "axios";
import chalk from "chalk";
import { CONFIG } from "./config.js";
import settingsManager from "./settingsManager.js";

async function getResponse(prompt, modelOverride, maxNewTokens = 4096) {
    // Load the latest settings to ensure we have the correct model path
    await settingsManager.load();
    const modelPath = modelOverride || settingsManager.get('model');

    // In a local-only setup, the 'model' is the path to the model files.
    // We don't dispatch to different providers, we just use the local server.
    if (!modelPath) {
        const errorMsg = "No local model selected. Please select a model using the /model command.";
        console.error(chalk.red(errorMsg));
        throw new Error(errorMsg);
    }

    console.log(chalk.yellow(`🧪 Using local OpenVINO model from path: ${modelPath}`));

    try {
        const payload = {
            prompt: prompt,
            // The model path is now passed in the request to the server,
            // which will handle loading the correct model.
            model_path: modelPath,
            max_new_tokens: maxNewTokens
        };
        const response = await axios.post(CONFIG.localOpenVinoServerUrl, payload, {
            headers: { "Content-Type": "application/json" },
        });

        if (response.data && response.data.generated_text) {
            return {
                content: [{ type: "text", text: response.data.generated_text }],
                // Usage is not tracked for local models
                usage: { input_tokens: 0, output_tokens: 0 }
            };
        }

        throw new Error("Local OpenVINO server response format error. Missing 'generated_text'.");

    } catch (error) {
        let errorMessage;
        if (error.response) {
            errorMessage = `OpenVINO server error: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
        } else if (error.request) {
            errorMessage = `No response from OpenVINO server at ${CONFIG.localOpenVinoServerUrl}. Is it running?`;
        } else {
            errorMessage = `Error making request to OpenVINO server: ${error.message}`;
        }
        console.error(chalk.red(errorMessage));
        throw new Error(errorMessage);
    }
}

export { getResponse };