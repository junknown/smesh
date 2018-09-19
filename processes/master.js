
const { Master } = require('../bundle');
const GlobalLogger = require('global-logger');
const program = require('commander');
const paramAnalyze = require('./paramAnalyze');

program
    .version('1.0.0')
    .usage('<name> [options]')
    .option('-m, --machine [value]', 'Machine id')
    .option('-p, --port [value]', 'Port remota del master')
    .option('-c, --configPath [file]', 'Configuration file path')
    .parse(process.argv);

if (program.args.length !== 1) {
    program.outputHelp();
    process.exit(0);
}
let configOption = paramAnalyze(program);

if (program.port) {
    configOption.meshSocket = configOption.meshSocket || {};
    configOption.meshSocket.port = program.port;
}


global.logger = GlobalLogger({ LOG_LEVEL: process.env.LOG_LEVEL, SUFFIX: 'Master ' + program.args[0] });

// process.env.MACHINE_ID = 'MACCHINA 1';
const start = async () => {
    global.logger.info(`Start del master ${program.args[0]} con machine id ${process.env.MACHINE_ID} su porta ${configOption.meshSocket.port}...`);
    let master = new Master(program.args[0], configOption);
    await master.start();
};


start().catch((err) => {
    global.logger.error("Errore nell'esecuzione", err);
});
