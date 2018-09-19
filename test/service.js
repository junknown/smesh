
const Service = require('../lib/service');

const GlobalLogger = require('global-logger');

process.env.LOG_LEVEL = 'DEBUG';
global.logger = GlobalLogger({ LOG_LEVEL: process.env.LOG_LEVEL || 'INFO', SUFFIX: 'Main' });


const start = async () => {
    let service = new Service('service1', ['start']);
    service.register('start', async (data) => {
        console.log('DATA?', data);
        return 'CIAO ' + data.nome;
    });
    await service.start();
};


start().catch((err) => {
    global.logger.error("Errore nell'esecuzione", err);
});
