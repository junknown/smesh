
const Client = require('../lib/client');

const GlobalLogger = require('global-logger');

process.env.LOG_LEVEL = 'DEBUG';
global.logger = GlobalLogger({ LOG_LEVEL: process.env.LOG_LEVEL || 'INFO', SUFFIX: 'Main' });

process.env.MACHINE_ID = 'MACCHINA 1';

const start = async () => {
    let client = new Client('test', { waitChannels: ['start'] });

    let interval;

    client.onConnect(() => {
        interval = setInterval(() => {
            client.execute('start', { nome: 'bau' }, { wait: true })
                .then((x) => {
                    console.log('RES', x);
                })
                .catch((err) => {
                    console.log('ERRORE', err);
                });
        }, 100);
    });

    client.onDisconnect(() => {
        clearInterval(interval);
    });

    await client.start();
};


start().then(() => {
    console.log('FINE');
}).catch((err) => { console.log('ERROR', err); });
