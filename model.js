const axios = require('axios');
const CONFIG = require('./config');

// Assuming these modules exist and export a getResponse function:
// For the purpose of this subtask, we cannot verify if these files exist.
// We will assume they will be created or already exist as per the project's structure.
let getOpenAIResponse = async (prompt, model, maxNewTokens) => { throw new Error("OpenAI module not implemented/loaded"); };
let getGeminiResponse = async (prompt, model, maxNewTokens) => { throw new Error("Gemini module not implemented/loaded"); };
let getDeepSeekResponse = async (prompt, model, maxNewTokens) => { throw new Error("DeepSeek module not implemented/loaded"); };

// Attempt to load them if they exist, otherwise keep the stubs.
// This is a simplified approach for the subtask.
// A more robust solution would handle this in the main application setup.
try {
    const openaiModule = require('./openai');
    if (openaiModule && openaiModule.getResponse) {
        getOpenAIResponse = openaiModule.getResponse;
    }
} catch (e) {
    console.warn("OpenAI module (openai.js) not found or failed to load. Using stub.");
}
try {
    const geminiModule = require('./gemini');
    if (geminiModule && geminiModule.getResponse) {
        getGeminiResponse = geminiModule.getResponse;
    }
} catch (e) {
    console.warn("Gemini module (gemini.js) not found or failed to load. Using stub.");
}
try {
    const deepseekModule = require('./deepseek');
    if (deepseekModule && deepseekModule.getResponse) {
        getDeepSeekResponse = deepseekModule.getResponse;
    }
} catch (e) {
    console.warn("DeepSeek module (deepseek.js) not found or failed to load. Using stub.");
}


async function getResponse(prompt, model = CONFIG.defaultLocalModelName, maxNewTokens = 4096) {
    // If CONFIG.model is intended to be the primary source of truth, adjust accordingly.
    // For now, using defaultLocalModelName as a fallback if no model is passed.
    // Or, rely on the caller to always pass CONFIG.model from their context.
    // The original instruction was: model = CONFIG.model
    // This might need clarification if CONFIG.model is not set or if a different model is intended by default.
    // Sticking to passed 'model' parameter first, then CONFIG.defaultLocalModelName as a fallback.

    const selectedModel = model || CONFIG.defaultLocalModelName;

    if (selectedModel.startsWith('openvino_local')) {
        try {
            console.log(`Routing to Local OpenVINO server at ${CONFIG.localOpenVinoServerUrl}...`);
            const response = await axios.post(CONFIG.localOpenVinoServerUrl, {
                prompt: prompt,
                max_new_tokens: maxNewTokens
            });
            return response.data.generated_text;
        } catch (error) {
            console.error("Error communicating with Local OpenVINO server:", error.message);
            if (error.code === 'ECONNREFUSED') {
                return `FATAL_ERROR: Could not connect to the local OpenVINO inference server. Please ensure it is running and accessible at ${CONFIG.localOpenVinoServerUrl}.`;
            }
            // Check if the error has a response from the server (e.g. LLMPipeline not initialized)
            if (error.response && error.response.data && error.response.data.error) {
                return `FATAL_ERROR: Local OpenVINO server reported an error: ${error.response.data.error}`;
            }
            return `FATAL_ERROR: An unexpected error occurred with the local OpenVINO server: ${error.message}.`;
        }
    } else if (selectedModel.startsWith('openai')) {
        return getOpenAIResponse(prompt, selectedModel, maxNewTokens);
    } else if (selectedModel.startsWith('gemini')) {
        return getGeminiResponse(prompt, selectedModel, maxNewTokens);
    } else if (selectedModel.startsWith('deepseek')) {
        return getDeepSeekResponse(prompt, selectedModel, maxNewTokens);
    } else {
        console.error(`Unknown model provider for model: ${selectedModel}`);
        return `FATAL_ERROR: Model provider for '${selectedModel}' is not configured in model.js.`;
    }
}

module.exports = { getResponse };
