import { registerCommand, registerGlobalOption, executeCommand, Context, getContext } from './src/main';

registerGlobalOption({
  key: 'config',
  default: '~/.config/finwo/cli-module.json',
  short: 'c',
  long: 'config',
  description: (ctx:Context) => `Set config file path`,
  handle: (ctx:Context,argv:string[]) => {
    ctx.config = argv.shift();
  }
});

registerCommand('dumpContext', {
  description: `Dumps the context and remaining arguments as given by the cli module`,
  handler(argv:string[]) {
    const ctx = getContext();
    console.log({ ctx, argv });
    return 0;
  }
});

executeCommand(process.argv.slice(2));
