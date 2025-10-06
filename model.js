import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import chalk from "chalk";
import { CONFIG } from "./config.js";
import { getTextDeepseek } from "./deepseek.js";
import { getTextGemini } from "./gemini.js";
import { getTextGpt } from "./openai.js";
import settingsManager from "./settingsManager.js";

async function getResponse(prompt, modelOverride, maxNewTokens = 4096) {
    // Load the latest settings, allowing for overrides
    await settingsManager.load();
    const model = modelOverride || settingsManager.get('model');
    const temperature = settingsManager.get('temperature');
    const apiKey = settingsManager.getApiKey(model);

    // --- Local OpenVINO Server ---
    if (model.startsWith("openvino")) {
        console.log(chalk.yellow(`🧪 Using local OpenVINO model via: ${CONFIG.localOpenVinoServerUrl}`));
        try {
            const response = await axios.post(CONFIG.localOpenVinoServerUrl, { prompt, max_new_tokens: maxNewTokens });
            if (response.data && response.data.generated_text) {
                return { content: [{ type: "text", text: response.data.generated_text }], usage: {} };
            }
            throw new Error("Local OpenVINO server response format error.");
        } catch (error) {
            const errorMessage = error.response
                ? `OpenVINO server error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
                : `No response from OpenVINO server at ${CONFIG.localOpenVinoServerUrl}. Is it running?`;
            console.error(chalk.red(errorMessage));
            throw new Error(errorMessage);
        }
    }

    // --- Provider-specific dispatching ---
    if (model.startsWith("deepseek")) {
        return await getTextDeepseek(prompt, temperature, model, apiKey);
    }
    if (model.startsWith("o3") || model.startsWith("o4")) {
        return await getTextGpt(prompt, temperature, model, apiKey);
    }
    if (model.startsWith("gemini")) {
        return await getTextGemini(prompt, temperature, model, apiKey);
    }

    // --- Default to Anthropic (Claude) ---
    if (!apiKey) {
        const errorMsg = "Claude API key not found. Please set it in ~/.autocode.settings.json or as CLAUDE_KEY env var.";
        console.log(chalk.red(errorMsg));
        throw new Error(errorMsg);
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
        model: model,
        max_tokens: CONFIG.maxTokens,
        temperature: temperature,
        messages: [{ role: "user", content: prompt }],
    });

    return response;
}

export { getResponse };