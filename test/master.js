

const Master = require('../lib/master');

const GlobalLogger = require('global-logger');

process.env.LOG_LEVEL = 'DEBUG';
global.logger = GlobalLogger({ LOG_LEVEL: process.env.LOG_LEVEL || 'INFO', SUFFIX: 'Main' });

process.env.MACHINE_ID = 'MACCHINA 2';

const start = async () => {
    let master = new Master('service1', { meshSocket: { port: 9001 } });
    await master.start();
    // let router2 = new ServiceRouter('service2', { meshSocket: { port: 9002 } });
    // await router2.start();
};


start().then(() => {
    console.log('FINE');
});
