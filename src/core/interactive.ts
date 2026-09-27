import readline from 'readline';
import { PythonBackend } from './backend/PythonBackend';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('SIGINT', () => {
  console.log('\n\n[Interactive] Received SIGINT. Shutting down engines...');
  PythonBackend.getInstance().shutdown();
  process.exit(0);
});

export function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`\x1b[36m?\x1b[0m ${query}`, (answer) => {
      resolve(answer.trim());
    });
  });
}

export async function askChoice(query: string, options: string[]): Promise<string> {
  console.log(`\n\x1b[36m?\x1b[0m ${query}`);
  options.forEach((opt, idx) => {
    console.log(`  \x1b[33m${idx + 1}.\x1b[0m ${opt}`);
  });

  while (true) {
    const answer = await askQuestion(`Select option (1-${options.length}): `);
    const num = parseInt(answer, 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) {
      return options[num - 1];
    }
    console.log(`\x1b[31mInvalid selection. Please enter a number between 1 and ${options.length}.\x1b[0m`);
  }
}

export async function askYesNo(query: string, defaultYes = true): Promise<boolean> {
  const defaultStr = defaultYes ? 'Y/n' : 'y/N';
  while (true) {
    const answer = await askQuestion(`${query} [${defaultStr}]: `);
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') return true;
    if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') return false;
    if (answer === '') return defaultYes;
    console.log('\x1b[31mPlease answer "y" or "n".\x1b[0m');
  }
}

export function closeInteractiveConsole() {
  rl.close();
  PythonBackend.getInstance().shutdown();
}


