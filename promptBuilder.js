class PromptBuilder {
    constructor() {
        this.sections = [];
        this.task = "";
        this.instructions = "";
    }

    setTask(task) {
        this.task = task;
        return this;
    }

    addSection(title, content) {
        if (content) {
            this.sections.push(`\n${title}:\n${content}`);
        }
        return this;
    }

    setInstructions(instructions) {
        this.instructions = instructions;
        return this;
    }

    build() {
        let prompt = `You are AutoCode, an automatic coding tool. ${this.task}`;
        prompt += this.sections.join("\n");
        prompt += `\n\n${this.instructions}`;
        return prompt;
    }
}

export default PromptBuilder;