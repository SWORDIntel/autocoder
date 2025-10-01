const model = require('./model');
const CONFIG = require('./config');

// Example function that might be used by the application to generate code.
async function generateCode(promptForCode, selectedModel) {
    console.log(`codeGenerator.js: Generating code with model: ${selectedModel || CONFIG.model}`);
    // Ensure a model is selected; fallback to CONFIG.model if available, then default in getResponse.
    // The userInterface.js should ideally pass the selected model value.
    // CONFIG.model might represent a system-wide default model if nothing is selected.
    const modelToUse = selectedModel || CONFIG.model;

    const generatedContent = await model.getResponse(
        promptForCode,
        modelToUse, // Pass the determined model
        CONFIG.maxNewTokens || 4096 // Use a configured value from CONFIG or a default
    );

    // Placeholder for further processing of generatedContent
    console.log("codeGenerator.js: Received content from model.");
    return generatedContent;
}

module.exports = {
    generateCode
};
