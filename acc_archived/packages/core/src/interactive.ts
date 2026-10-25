import * as prompt from '@clack/prompts';

export const intro = prompt.intro;
export const outro = prompt.outro;
export const isCancel = prompt.isCancel;
export const cancel = prompt.cancel;

export function handleCancel(value: any): void {
  if (prompt.isCancel(value)) {
    prompt.cancel('Operation cancelled.');
    process.exit(0);
  }
}

export async function askQuestion(message: string, placeholder = '', defaultValue = ''): Promise<string> {
  const result = await prompt.text({
    message,
    placeholder,
    defaultValue,
  });
  if (prompt.isCancel(result)) {
    prompt.cancel('Operation cancelled.');
    process.exit(0);
  }
  const answer = (result as string).trim();
  return answer.length > 0 ? answer : defaultValue;
}

export async function askChoice(message: string, options: (string | { label: string; value: string; hint?: string })[]): Promise<string> {
  const formattedOptions = options.map((opt) => {
    if (typeof opt === 'string') {
      return { label: opt, value: opt };
    }
    return opt;
  });

  const result = await prompt.select({
    message,
    options: formattedOptions,
  });

  if (prompt.isCancel(result)) {
    prompt.cancel('Operation cancelled.');
    process.exit(0);
  }

  return result as string;
}

export async function askYesNo(message: string, defaultYes = true): Promise<boolean> {
  const result = await prompt.confirm({
    message,
    initialValue: defaultYes,
  });

  if (prompt.isCancel(result)) {
    prompt.cancel('Operation cancelled.');
    process.exit(0);
  }

  return Boolean(result);
}

export function closeInteractiveConsole(): void {
  // No-op for clack compatibility
}
