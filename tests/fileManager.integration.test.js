import FileManager from '../fileManager.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('FileManager Integration Tests', () => {
    let tempDir;

    beforeEach(async () => {
        // Create a unique temporary directory for each test
        const tempPath = path.join(os.tmpdir(), 'file-manager-tests-');
        tempDir = await fs.mkdtemp(tempPath);
    });

    afterEach(async () => {
        // Clean up the temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    test('should write and read a file on the actual filesystem', async () => {
        const filePath = path.join(tempDir, 'test.txt');
        const content = 'Hello, integration test!';

        // Write the file
        await FileManager.write(filePath, content);

        // Check if the file exists
        const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);

        // Read the file back using the manager
        const readContent = await FileManager.read(filePath);
        expect(readContent).toBe(content);
    });

    test('should create subfolders when writing a file', async () => {
        const nestedPath = path.join(tempDir, 'a', 'b', 'c.txt');
        const content = 'Nested content';

        await FileManager.write(nestedPath, content);

        const readContent = await fs.readFile(nestedPath, 'utf8');
        expect(readContent).toBe(content);
    });

    test('should delete a file from the filesystem', async () => {
        const filePath = path.join(tempDir, 'deleteme.txt');
        await fs.writeFile(filePath, 'some data');

        await FileManager.deleteFile(filePath);

        const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(fileExists).toBe(false);
    });
});