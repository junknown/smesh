
const Client = require('../lib/client');
const Router = require('../lib/router');

const GlobalLogger = require('global-logger');

process.env.LOG_LEVEL = 'DEBUG';
global.logger = GlobalLogger({ LOG_LEVEL: process.env.LOG_LEVEL || 'INFO', SUFFIX: 'Main' });

process.env.MACHINE_ID = 'MACCHINA 1';
const start = async () => {
    let router = new Router('test');

    await router.start();
};


start();
