import { GoogleGenerativeAI } from "@google/generative-ai";
import chalk from "chalk";

export async function getTextGemini(prompt, temperature, modelName, apiKey) {
    if (!(apiKey || process.env.GEMINI_KEY)) {
        console.log(chalk.red("Please set up GEMINI_KEY environment variable"));
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    const generationConfig = {
        temperature,
        maxOutputTokens: 65536,
        responseMimeType: "text/plain",
    };

    const chatSession = model.startChat({
        generationConfig,
        history: [],
    });

    const result = await chatSession.sendMessage(prompt);
    return { content: [{ text: result.response.text() }] };
}
