const { Client } = require('../bundle.js');
const GlobalLogger = require('global-logger');

process.env.LOG_LEVEL = 'INFO';
global.logger = GlobalLogger({ LOG_LEVEL: process.env.LOG_LEVEL || 'INFO', SUFFIX: 'Main' });
async function start() {
    let p = [];

    let size = 500;
    let clients = [];
    for (let i = 0; i < 100; i++) {
        let masterName = i % 2 === 0 ? 'master' : 'master2';
        clients.push(new Client(masterName));
        await clients[clients.length - 1].start();
    }
    let rpc = {
        name: 'test.testChannel1', wait: true, params: { test: 'Pippo' }
    };
    let time = new Date().getTime();
    for (let i = 0; i < size; i++) {
        clients.forEach(x => p.push(x.callRpc(rpc)));
    }
    let res = await Promise.all(p);
    let duration = new Date().getTime() - time;
    console.log(`Time ${duration} Rate ${Math.round((p.length) / (duration / 1000))} op/s`);
    process.exit(0);
}


start().then(() => {
    console.log('FINITO');
});
