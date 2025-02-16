import { getContext, createContext } from '@finwo/context-module';
import { sep } from 'node:path';

export { getContext } from '@finwo/context-module';

type CommandHandler = (argv:string[])=>number|Promise<number>;
type CommandDescriptor = {
  handler      : CommandHandler;
  description ?: string;
};
const commands: Record<string, CommandDescriptor> = {};

export type Context = Record<string, any>;

type GlobalOptionDescriptor = {
  key: string;
  long?: string|string[];
  short?: string|string[];
  description: string|((ctx:Context)=>string);
  handle: (ctx: Context, argv: string[])=>void|Promise<void>;
  default?: any;
};
const globalOptions: GlobalOptionDescriptor[] = [];

export function registerCommand(name: string, descriptor: CommandDescriptor): void {
  commands[name] = descriptor;
};

export function registerGlobalOption(descriptor: GlobalOptionDescriptor): void {
  // TODO: filter duplicates
  globalOptions.push(descriptor);
}

// Parses arguments and starts command in a fresh context
export async function executeCommand(argv: string[]): Promise<number> {
  let   command: string = 'help';
  const options: Context = globalOptions.reduce((r,opt) => {
    if ('default' in opt) r[opt.key] = opt.default;
    return r;
  }, {});

  const longOpts  = globalOptions.filter(opt => opt.long).map(opt => ({ ...opt, long: Array.isArray(opt.long) ? opt.long : [opt.long] }));
  const shortOpts = globalOptions.filter(opt => opt.short).map(opt => ({ ...opt, short: Array.isArray(opt.short) ? opt.short : [opt.short] }));

  // Parse options until a command is reached
  while(argv.length) {
    const arg = argv.shift();

    // Long options
    if (arg.charAt(0) == '-' && arg.charAt(1) == '-') {
      const lopt = arg.slice(2);
      const _opt = longOpts.find(opt => opt.long.includes(lopt));
      if (!_opt) {
        process.stderr.write(`Unknown option: '${lopt}'\n`);
        process.exit(1);
      }
      await _opt.handle(options, argv);
      continue;
    }

    // Short options
    if (arg.charAt(0) == '-') {
      // Short options
      const flags = arg.split('');
      flags.shift();
      while(flags.length) {
        const sopt = flags.shift();
        const _opt = shortOpts.find(opt => opt.short.includes(sopt));
        if (!_opt) {
          process.stderr.write(`Unknown option: '${sopt}'\n`);
          process.exit(1);
        }
        await _opt.handle(options, argv);
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
  return createContext(options, async () => {
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

    const longestOption = globalOptions.reduce((r,opt) => {
      const shorts = [opt.short||[]].flat().map(s => '-'+s);
      const longs  = [opt.long||[]].flat().map(s => '--'+s);
      return Math.max(r, [shorts,longs].flat().join(' ').length);
    }, 0);
    for(const opt of globalOptions) {
      const shorts = [opt.short||[]].flat().map(s => '-'+s);
      const longs  = [opt.long||[]].flat().map(s => '--'+s);
      const both   = [...shorts,...longs].join(' ');
      process.stdout.write(`  ${both}  `);
      process.stdout.write(' '.repeat(longestOption - both.length));
      if ('function' === typeof opt.description) {
        process.stdout.write(opt.description(ctx));
        process.stdout.write('\n');
      }
    }

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

registerGlobalOption({
  key: 'loglevel',
  default: 0,
  short: 'v',
  long: 'verbose',
  description: (ctx:Context) => `Increase loglevel (current: ${ctx.loglevel})`,
  handle: (ctx:Context,_) => {
    ctx.loglevel = ctx.loglevel || 0;
    ctx.loglevel++;
  }
});

export default {
  registerCommand,
  executeCommand,
  getContext,
};
