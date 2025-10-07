import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const command = 'node';
const args = ['index.js'];
const options = { stdio: ['pipe', 'pipe', 'pipe'] };
const child = spawn(command, args, options);

const newFileName = 'test_file_created_by_tui.txt';
const newFilePath = path.join(process.cwd(), newFileName);
let testPassed = false;

console.log('Starting TUI test for "Add new file"...');

child.stdout.on('data', (data) => {
  // console.log(`TUI stdout: ${data.toString()}`);
});

child.stderr.on('data', (data) => {
  console.error(`TUI stderr: ${data.toString()}`);
});

child.on('close', async (code) => {
  console.log(`TUI process exited with code ${code}`);
  try {
    await fs.access(newFilePath);
    console.log(`✅ TEST PASSED: File "${newFileName}" was created successfully.`);
    testPassed = true;
  } catch (error) {
    console.error(`❌ TEST FAILED: File "${newFileName}" was not found.`);
  } finally {
    if (testPassed) {
      try {
        await fs.unlink(newFilePath);
        console.log(`🧹 Cleaned up ${newFileName}.`);
      } catch (e) {
        console.error(`Error during cleanup: ${e.message}`);
      }
    }
  }
});

function sendKeystrokes() {
  console.log('Sending keystrokes to test "Add new file"...');

  // "Add new file" is the 10th action. We need 9 down arrows.
  for (let i = 0; i < 9; i++) {
    child.stdin.write('\x1b[B'); // Down Arrow
  }

  child.stdin.write('\r'); // Select "Add new file"

  setTimeout(() => {
    console.log(`Typing filename: ${newFileName}`);
    child.stdin.write(newFileName);

    setTimeout(() => {
      console.log('Tabbing to submit button...');
      child.stdin.write('\t'); // Tab to focus the button

      setTimeout(() => {
        console.log('Pressing Enter to submit...');
        child.stdin.write('\r'); // Enter to press the button

        setTimeout(() => {
            console.log('Quitting TUI...');
            child.stdin.write('q');
            child.stdin.end();
        }, 2000);
      }, 1000);
    }, 1000);
  }, 2000);
}

setTimeout(sendKeystrokes, 3000);