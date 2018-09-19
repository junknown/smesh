
const { Router } = require('../bundle');
const GlobalLogger = require('global-logger');
const program = require('commander');
const paramAnalyze = require('./paramAnalyze');

program
    .version('1.0.0')
    .usage('<name> [options]')
    .option('-i, --id <value>', 'Id del router')
    .option('-m, --machine <value>', 'Machine id')
    .option('-c, --configPath [file]', 'Configuration file path')
    .parse(process.argv);
if (program.args.length !== 1) {
    console.log('Nome del router non specificato.');
    program.outputHelp();
    process.exit(0);
}
let configOption = paramAnalyze(program);

global.logger = GlobalLogger({ LOG_LEVEL: process.env.LOG_LEVEL, SUFFIX: 'Router ' + program.args[0] });

// process.env.MACHINE_ID = 'MACCHINA 1';
const start = async () => {
    global.logger.info(`Start del router ${program.args[0]} con machine id ${process.env.MACHINE_ID}...`);
    let router = new Router(program.args[0], configOption);
    await router.start();
};


start().catch((err) => {
    global.logger.error("Errore nell'esecuzione", err);
});
