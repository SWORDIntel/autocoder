import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { CONFIG } from "./config.js";
import { getTextDeepseek } from "./deepseek.js";
import { getTextGpt } from "./openai.js";
import { getTextGemini } from "./gemini.js";
import chalk from "chalk";
import axios from "axios";

async function _getModel() {
    try {
        const settings = await fs.readFile(path.join(os.homedir(), ".settings.json"), "utf8");
        const { model } = JSON.parse(settings);
        return model || "claude-3-5-sonnet-20240620";
    } catch {
        return "claude-3-5-sonnet-20240620";
    }
}

async function _getTemperature() {
    try {
        const settings = await fs.readFile(path.join(os.homedir(), ".settings.json"), "utf8");
        const { temperature } = JSON.parse(settings);
        return temperature || 0.7;
    } catch {
        return 0.7;
    }
}

export async function getResponse(prompt, model, apiKey, maxNewTokens = 100) {
    model = model || (await _getModel());
    const temperature = await _getTemperature();

    if (model === "openvino_local") {
        console.log(chalk.yellow(`🧪 Using local OpenVINO model via: ${CONFIG.localOpenVinoServerUrl}`));
        try {
            const payload = {
                prompt: prompt,
                max_new_tokens: maxNewTokens
            };
            const response = await axios.post(CONFIG.localOpenVinoServerUrl, payload, {
                headers: { "Content-Type": "application/json" },
            });

            if (response.data && response.data.generated_text) {
                return {
                    content: [{ type: "text", text: response.data.generated_text }],
                    usage: { input_tokens: 0, output_tokens: 0 }
                };
            } else {
                console.error(chalk.red("Error: Local OpenVINO server response did not contain 'generated_text'. Response:"), response.data);
                throw new Error("Local OpenVINO server response format error.");
            }
        } catch (error) {
            if (error.response) {
                console.error(chalk.red(`Error from OpenVINO server: ${error.response.status} - ${JSON.stringify(error.response.data)}`));
                throw new Error(`OpenVINO server error: ${error.response.status} - ${error.response.data.error || "Unknown error"}`);
            } else if (error.request) {
                console.error(chalk.red(`Error: No response from OpenVINO server at ${CONFIG.localOpenVinoServerUrl}. Is it running?`));
                throw new Error(`No response from OpenVINO server. Ensure it's running at ${CONFIG.localOpenVinoServerUrl}.`);
            } else {
                console.error(chalk.red(`Error making request to OpenVINO server: ${error.message}`));
                throw new Error(`Error making request to OpenVINO server: ${error.message}`);
            }
        }
    }

    if (model.startsWith("deepseek")) {
        return await getTextDeepseek(prompt, temperature, model, apiKey);
    }

    if (model.startsWith("o3") || model.startsWith("o4")) {
        return await getTextGpt(prompt, temperature, model, apiKey);
    }

    if (model.startsWith("gemini")) {
        return await getTextGemini(prompt, temperature, model, apiKey);
    }

    if (!(apiKey || process.env.CLAUDE_KEY)) {
        console.log(chalk.red("Please set up CLAUDE_KEY environment variable"));
        process.exit(1);
    }

    const anthropic = new Anthropic({ apiKey: apiKey || process.env.CLAUDE_KEY });

    let maxTokens = CONFIG.maxTokens;
    let thinkingConfig = undefined;

    if (model.includes("3.7")) {
        maxTokens = 20000;
        thinkingConfig = {
            type: "enabled",
            budget_tokens: 10000,
        };
    }

    const response = await anthropic.messages.create({
        model: model,
        max_tokens: maxTokens,
        ...(thinkingConfig && { thinking: thinkingConfig }),
        temperature: temperature,
        messages: [{ role: "user", content: prompt }],
    });

    return response;
}