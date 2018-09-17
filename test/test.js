const { ProcessManagerUtils, Client } = require('../bundle.js');
const GlobalLogger = require('global-logger');
const pm2 = require('pm2');

const Path = require('path');
let chai = require('chai');
let muteFnc = require('mute');

const TO_MUTE = false;
process.env.LOG_LEVEL = 'INFO';
global.logger = GlobalLogger({ LOG_LEVEL: process.env.LOG_LEVEL || 'INFO', SUFFIX: 'Main' });
const mute = () => {
    if (TO_MUTE) { return muteFnc(); } else return () => { };
};
/* global describe,before,after,it */
/* eslint no-multi-str:0 */

const util = require('util');

let pm = {
    connect: util.promisify(pm2.connect.bind(pm2)),
    list: util.promisify(pm2.list.bind(pm2)),
    launchBus: util.promisify(pm2.launchBus.bind(pm2)),
    start: util.promisify(pm2.start.bind(pm2)),
    stop: util.promisify(pm2.stop.bind(pm2)),
    delete: util.promisify(pm2.delete.bind(pm2)),
    describe: util.promisify(pm2.describe.bind(pm2)),
    disconnect: util.promisify(pm2.disconnect.bind(pm2)),
    sendDataToProcessId: util.promisify(pm2.sendDataToProcessId.bind(pm2)),
    killDaemon: util.promisify(pm2.killDaemon.bind(pm2))
};

let client;

describe('Smesh test', () => {
    before(async () => {
        await ProcessManagerUtils.configure({
            master: [{
                name: 'master',
                mergeLogs: false,
                options: {
                    maxRpcPendingsWarning: 100000,
                    queueSize: 1000000
                },
                redis: {
                    port: process.env.CLUSTER_REDIS_PORT || '6379',
                    host: process.env.CLUSTER_REDIS_HOST || 'localhost',
                    retryTime: parseInt(process.env.CLUSTER_REDIS_RETRY_TIME || 5000, 10)
                },
                autodiscover: {
                    helloInterval: parseInt(process.env.CLUSTER_AUTODISCOVER_HELLOTIME || 1000, 10),
                    nodeTimeout: parseInt(process.env.CLUSTER_AUTODISCOVER_NODETIMEOUT || 5000, 10)
                },
                server: {
                    port: 3005
                },
                worker: {
                    mergeLogs: true,
                    name: 'worker',
                    instances: 2,
                    logics: [
                        { path: Path.join(__dirname, 'TestJob.js'), options: {} },
                        { path: Path.join(__dirname, 'TestJob2.js'), options: {} }
                    ],
                }
            },
            {
                name: 'master2',
                output: './logs/master2.log',
                error: './logs/master2.log',
                mergeLogs: false,
                mesh: {
                    autodiscover: {
                        helloInterval: 5000, // opz
                        multicasAddr: '233.255.255.1', // opz
                        port: 20000 // opz
                    },
                    server: {
                        port: 3006, // opz
                        zeromq: {
                            connectTimeout: 10000, //  opz
                            sendHighWaterMark: 10000, // opz
                            receiveHighWaterMark: 10000 // opz
                        }
                    },
                    peer: {
                        zeromq: {
                            connectTimeout: 10000, //  opz
                            sendHighWaterMark: 10000, // opz
                            receiveHighWaterMark: 10000 // opz
                        }
                    }
                },
                worker: {
                    mergeLogs: false,
                    name: 'worker2',
                    instances: 2,
                    logics: [
                        { path: Path.join(__dirname, 'TestJob.js'), options: {} }
                    ],
                    output: './logs/worker2.log',
                    error: './logs/worker2.log'
                }
            }],
            processes: []
        });
        await pm.connect();
        client = new Client('master');
        await client.start();
    });
    after(async () => {
        try {
            let unmute = mute();
            // await pm.killDaemon();
            unmute();
        } catch (err) {
            console.log('errore nell after All', err);
        }
    });

    describe('Processi Up', () => {
        it('Test di funzionamento per vedere se i processi sono up', async () => {
            let unmute = mute();

            let processList = await pm.list();
            unmute();
            chai.expect(processList).has.lengthOf(6);
            chai.expect(processList.map(x => x.name)).to.include.members(['worker', 'master', 'master2', 'worker2']);
        });
    });

    describe('Rpc semplice', () => {
        it('Test di funzionamento rpc semplice', async () => {
            let unmute = mute();


            let rpc = {
                name: 'test.testChannel1', wait: true, params: { test: 'Pippo' }
            };
            let res = await client.callRpc(rpc);
            chai.expect(res).eq('CIAO ' + rpc.params.test + ' 1');
            unmute();
        });
    });

    describe('Rpc semplice', () => {
        it('Test di funzionamento di più rpc in serie', async () => {
            let unmute = mute();


            let rpc = {
                name: 'test.testChannel1', wait: true, params: { test: 'Pippo' }
            };
            let res = await client.callRpc({ name: 'test.testChannel1', wait: true, params: { test: 'Pippo' } });
            let res2 = await client.callRpc({ name: 'test.testChannel2', wait: true, params: { test: 'Pippo' } });

            chai.expect(res).eq('CIAO ' + rpc.params.test + ' 1');
            chai.expect(res2).eq('CIAO ' + rpc.params.test + ' 2');
            unmute();
        });
    });


    describe('Broadcast', () => {
        it('Test di funzionamento rpc broadcast', async () => {
            let unmute = mute();

            let res = await client.callRpc({
                name: 'global.manutenzione', wait: true, params: { test: 'Pippo' }, peerPreference: { broadcast: true }
            });
            console.log('RES', res);
            unmute();
            chai.expect(res).to.be.an('array').eql([true, true, true, true, true, true]);
        });
    });


    describe('Performance', () => {
        it('Test di performance rpc in parallelo', async () => {
            let unmute = mute();

            let rpc = {
                name: 'test.testChannel1', wait: true, params: { test: 'Pippo' }
            };

            let p = [];
            let time = new Date().getTime();
            let size = 10000;
            for (let i = 0; i < size; i++) {
                p.push(client.callRpc(rpc));
            }
            let res = await Promise.all(p);
            let duration = new Date().getTime() - time;
            unmute();
            chai.expect(res).to.be.an('array').that.has.lengthOf(size);
            console.log(`\tTime ${duration} Rate ${Math.round((size) / (duration / 1000))} op/s`);
        });
    });

    describe('Performance', () => {
        it('Test di performance rpc multiclient,singolo master, in parallelo', async () => {
            let unmute = mute();

            let rpc = {
                name: 'test.testChannel1', wait: true, params: { test: 'Pippo' }
            };

            let p = [];
            let time = new Date().getTime();
            let size = 1000;

            let clients = [];
            for (let i = 0; i < 10; i++) {
                clients.push(new Client('master'));
                await clients[clients.length - 1].start();
            }

            for (let i = 0; i < size; i++) {
                clients.forEach(x => p.push(x.callRpc(rpc)));
            }
            let res = await Promise.all(p);
            let duration = new Date().getTime() - time;

            clients.forEach((x) => { x.close(); });
            unmute();
            console.log(`\tTime ${duration} Rate ${Math.round((p.length) / (duration / 1000))} op/s`);
            chai.expect(res).to.be.an('array').that.has.lengthOf(size * 10);
        });
    });

    describe('Performance', () => {
        it('Test di performance rpc multi client,multi master, in parallelo', async () => {
            let unmute = mute();


            let p = [];
            let time = new Date().getTime();
            let size = 1000;

            let clients = [];
            for (let i = 0; i < 10; i++) {
                let masterName = i % 2 === 0 ? 'master' : 'master2';
                clients.push(new Client(masterName));
                await clients[clients.length - 1].start();
            }

            for (let i = 0; i < size; i++) {
                let rpc = {
                    name: 'test.testChannel1', wait: true, params: { test: 'Pippo' }
                };
                clients.forEach((x, xi) => {
                    rpc.params.bo = i + '_' + xi;
                    p.push(x.callRpc(rpc));
                });
            }
            let res = await Promise.all(p);
            let duration = new Date().getTime() - time;
            clients.forEach((x) => { x.close(); });
            unmute();
            console.log(`\tTime ${duration} Rate ${Math.round((p.length) / (duration / 1000))} op/s`);
            chai.expect(res).to.be.an('array').that.has.lengthOf(p.length);
        });
    });

    describe.skip('Performance', () => {
        it('Test di performance rpc broadcast', async () => {
            let unmute = mute();

            let error = 0;
            let rpc = {
                name: 'global.manutenzione', wait: true, params: { test: 'Pippo' }, peerPreference: { broadcast: true }
            };

            let res = [];
            let time = new Date().getTime();
            let size = 10000;
            for (let i = 0; i < size; i++) {
                try {
                    let r = await client.callRpc(rpc);
                    if (i % 100 === 0) console.log('Fatti ' + i);
                    res.push(r);
                } catch (exc) {
                    console.log('Errore', exc);
                    error++;
                }
            }
            let duration = new Date().getTime() - time;
            unmute();
            console.log(`\tTime ${duration} Rate ${Math.round((size) / (duration / 1000))} op/s , Errors:${error}`);
            chai.expect(res).to.be.an('array').that.has.lengthOf(size);
        });
    });
    describe.skip('Performance', () => {
        it('Test di performance rpc volatile', async () => {
            let unmute = mute();

            let error = 0;
            let rpc = {
                name: 'global.manutenzione', wait: false, params: { test: 'Pippo' }, peerPreference: { volatile: true }
            };

            let res = [];
            let time = new Date().getTime();
            let size = 100000;
            for (let i = 0; i < size; i++) {
                try {
                    let r = await client.callRpc(rpc);
                    // if (i % 100 === 0) console.log('Fatti ' + i);
                    res.push(r);
                } catch (exc) {
                    console.log('Errore', exc);
                    error++;
                }
            }
            let duration = new Date().getTime() - time;
            unmute();
            console.log(`\tTime ${duration} Rate ${Math.round((size) / (duration / 1000))} op/s , Errors:${error}`);
            chai.expect(res).to.be.an('array').that.has.lengthOf(size);
        });
    });
});
