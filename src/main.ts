import { AsyncLocalStorage } from 'node:async_hooks';
import { sep } from 'node:path';

const context = new AsyncLocalStorage();

type CommandHandler = (argv:string[])=>number|Promise<number>;
type CommandDescriptor = {
  handler      : CommandHandler;
  description ?: string;
};
const commands: Record<string, CommandDescriptor> = {};

type Context = {
  loglevel: number,
} & Record<string, any>;

export function getContext(): Context {
  return context.getStore() as Context;
};

export function registerCommand(name: string, descriptor: CommandDescriptor): void {
  commands[name] = descriptor;
};

// Parses arguments and starts command in a fresh context
export async function executeCommand(argv: string[]): Promise<number> {
  let   command: string = 'help';
  const options: Context = {
    loglevel: 0,
  };

  // Parse options until a command is reached
  while(argv.length) {
    const arg = argv.shift();

    // Long options
    if (arg.charAt(0) == '-' && arg.charAt(1) == '-') {
      const lopt = arg.slice(2);
      switch(lopt.toLowerCase()) {
        case 'verbose':
          options.loglevel++;
          break;
        default:
          process.stderr.write(`Unknown option: '${lopt}'\n`);
          process.exit(1);
      }
      continue;
    }

    // Short options
    if (arg.charAt(0) == '-' && arg.charAt(1) != '-') {
      // Short options
      const flags = arg.split('');
      flags.shift();
      while(flags.length) {
        const sopt = flags.shift();
        switch(sopt) {
          case 'v':
            options.loglevel++;
            break;
          default:
            process.stderr.write(`Unknown option: '${sopt}'\n`);
            process.exit(1);
        }
      }
      continue;
    }

    // Assume this is a command
    command = arg;
    break;
  }

  // Validate the chosen command exists
  if (!(command in commands)) {
    process.stderr.write(`Unknown command: ${command}\n`);
    process.exit(1);
  }

  // Execute the command
  return context.run(options, async () => {
    return commands[command].handler(argv);
  });
};

function getProcessName(): string {
  const tokens = process.argv;
  while(tokens.length) {
    const token = tokens.shift().split(sep).pop();
    if (token.toLowerCase() == 'node') continue;
    return token;
  }
  return process.argv.join(', ');
}

registerCommand('help', {
  description: 'Print global usage and available commands',
  handler: (): number => {
    const ctx = getContext();
    process.stdout.write(`Usage: ${getProcessName()} [global opts] <command> [local opts]\n`);
    process.stdout.write(`\n`);
    process.stdout.write(`Global options:\n`);
    process.stdout.write(`  -v --verbose  Increase loglevel (current: ${ctx.loglevel})\n`);
    process.stdout.write(`\n`);
    process.stdout.write(`Commands:\n`);
    const commandNames = Object.keys(commands);
    const longestName  = commandNames.map(s => s.length).reduce((r,a) => Math.max(r,a));
    for(const name of commandNames) {
      process.stdout.write(`  ${name}  `);
      process.stdout.write(' '.repeat(longestName - name.length));
      process.stdout.write(commands[name].description ?? '');
      process.stdout.write('\n');
    }
    return 0;
  },
});

export default {
  registerCommand,
  executeCommand,
  getContext,
};
