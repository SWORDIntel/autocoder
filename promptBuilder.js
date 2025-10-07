import path from "path";

const PromptBuilder = {
  buildFixLintErrorsPrompt(language, filePath, lintOutput, fileContent, projectStructure) {
    return `
Please fix the following linter errors in the ${language} file ${filePath}:
${lintOutput}
Current file content:
${fileContent}
Project structure:
${JSON.stringify(projectStructure, null, 2)}
Please provide the corrected code that addresses all the linter errors. Consider the project structure when making changes. Do not include any explanations or comments in your response, just provide the code.`;
  },

  buildOptimizeProjectStructurePrompt(projectStructure) {
    return `
Analyze the following project structure and provide optimization suggestions:

${JSON.stringify(projectStructure, null, 2)}

Please provide suggestions for optimizing the project structure, including:
1. Reorganizing files and folders
2. Splitting or merging modules
3. Improving naming conventions
4. Enhancing overall project architecture

Provide the suggestions in a structured format.
`;
  },

  buildAnalyzeCodeQualityPrompt(language, fileContent, memoryContext) {
    return `
Analyze the following ${language} code for quality and provide improvement suggestions:
${fileContent}
${memoryContext}
Please consider:
1. Adherence to DRY, KISS, and SRP principles
2. Code readability and maintainability
3. Potential performance improvements
4. Error handling and edge cases
5. Security considerations
6. ${language}-specific best practices
Provide the suggestions in a structured format.`;
  },

  buildDetectMissingDependenciesPrompt(projectStructure, dependenciesGraph, packageContent) {
    return `
     Analyze the following project structure and detect any missing dependencies or files:

     ${JSON.stringify(projectStructure, null, 2)}

     Dependencies graph:

     ${JSON.stringify(dependenciesGraph, null, 2)}

     Package file content:
     ${packageContent}

     Please identify:
     1. Missing packages based on import statements for each supported language (e.g., {"javascript": ["react"], "python": ["numpy"]})
     2. Missing files that are referenced but not present in the project structure (please always return filenames based on repo root)
     3. Potential circular dependencies
     4. Dependencies listed in the package file but not used in the project
     5. Dependencies used in the project but not listed in the package file

     Provide the results in a single JSON code snippet.
     `;
  },

  buildDetectDeadCodePrompt(projectStructure, fileContents) {
    return `
Analyze the following project files and identify any dead code. Dead code includes unused exports, functions, classes, or variables that are not referenced anywhere in the project.

Project Structure:
${JSON.stringify(projectStructure, null, 2)}

File Contents:
${fileContents}

Please provide the results as a JSON object where the keys are file paths and the values are arrays of objects, each with 'name' and 'line' of the dead code.
`;
  },

  buildDetectCodeSmellsPrompt(filePath, fileContent) {
    return `
Analyze the following file for code smells: ${filePath}

Code:
${fileContent}

Please identify common code smells such as:
- Long methods
- Large classes
- Duplicated code
- Feature envy
- Inappropriate intimacy
- Shotgun surgery

Provide the results as a list of code smells found, with a brief explanation and the line number where the smell occurs.
`;
  },

  buildSuggestCrossFileRefactoringPrompt(fileContents) {
    return `
Analyze the following files and suggest cross-file refactorings:

${fileContents}

Please identify opportunities to:
- Extract shared logic into new modules
- Move functions or classes to more appropriate files
- Improve the overall project structure by refactoring across files

Provide the results as a list of suggestions, with a clear explanation of the proposed changes.
`;
  },

  buildGeneratePrompt(fileName, readme, currentCode, projectStructure, allFileContents, language, fileExtension, linter, formatter, packageManager) {
    return `
You are AutoCode, an automatic coding tool. Your task is to generate or update the ${fileName} file based on the README.md instructions, the current ${fileName} content (if any), the project structure, and the content of all other files.

README.md content:
${readme}

Current ${fileName} content (if exists):
${currentCode || "No existing code"}

Project structure:
${JSON.stringify(projectStructure, null, 2)}

Content of other selected files:
${Object.entries(allFileContents)
    .filter(([key]) => key !== fileName)
    .map(([key, value]) => `${key}:\n${value}`)
    .join("\n\n")}

Language: ${language}
File extension: ${fileExtension}
Linter: ${linter}
Formatter: ${formatter}
Package manager: ${packageManager}

Please generate or update the ${fileName} file to implement the features described in the README. Ensure the code is complete, functional, and follows best practices for ${language}. Consider the project structure and the content of other selected files when making changes or adding new features. Reuse functionality from other modules and avoid duplicating code. Do not include any explanations or comments in your response, just provide the code.
`;
  },

  buildUpdateReadmePrompt(readme, projectStructure) {
    return `
You are AutoCode, an automatic coding tool. Your task is to update the README.md file with new design ideas and considerations based on the current content and project structure.

Current README.md content:
${readme}

Project structure:
${JSON.stringify(projectStructure, null, 2)}

Please update the README.md file with new design ideas and considerations. Ensure the content is well-structured and follows best practices. Consider the current project structure when suggesting improvements or new features. Do not include any explanations or comments in your response, just provide the updated README.md content.
`;
  },

  buildSplitLargeFilePrompt(filePath, maxFileLines, language, content, projectStructure) {
    return `
The file ${filePath} exceeds ${maxFileLines} lines. Please suggest how to split this file into smaller, more manageable parts. Consider the following:

1. Identify logical components or functionalities that can be separated.
2. Suggest new file names for the extracted parts.
3. Provide the content for each new file, including the updated content for the original file.
4. Ensure that the split maintains the overall functionality and doesn't break any dependencies.
5. Use appropriate language-specific conventions for ${language}.

Current file content:
${content}

Project structure:
${JSON.stringify(projectStructure, null, 2)}

Please provide your suggestions in the following Markdown format:

# Original File: [original_file_name]
[content for the original file]

# New File: [new_file_name_1]
[content for new_file_1]

# New File: [new_file_name_2]
[content for new_file_2]

... (repeat for all new files)
`;
  },

  buildOptimizeAndRefactorFilePrompt(filePath, fileContent, projectStructure, language, linter, formatter, packageManager) {
    return `
Please optimize and refactor the following code from ${filePath}:

${fileContent}

Project structure:
${JSON.stringify(projectStructure, null, 2)}

Language: ${language}
File extension: ${path.extname(filePath)}
Linter: ${linter}
Formatter: ${formatter}
Package manager: ${packageManager}

Focus on:
1. Improving code efficiency
2. Enhancing readability
3. Applying design patterns where appropriate
4. Reducing code duplication
5. Improving overall code structure
6. Ensuring consistency with the project structure
7. Reusing functionality from other modules
8. Following best practices and conventions for ${language}

Return the optimized and refactored code ONLY!! without explanations or comments or md formatting. Do not include any explanations or comments in your response, just provide the code.
`;
  },
};

export default PromptBuilder;