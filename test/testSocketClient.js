
const GlobalLogger = require('global-logger');


process.env.LOG_LEVEL = 'DEBUG';
global.logger = GlobalLogger({ LOG_LEVEL: process.env.LOG_LEVEL || 'INFO', SUFFIX: 'Main' });

let size = 100000;
let outputSize = size;
let tt = 0;
let time;


const getSend = () => {
    let obj = { c: [] };
    for (let i = 0; i < 1; i++) {
        obj.c.push({ a: 'pippo', b: 'asdasda', c: ['s', '0ssasdasdasdasdadas ', 'asdasdasda'] });
    }
    let a = JSON.stringify({ a: obj });
    time = new Date().getTime();

    return a;
};

const onData = (data) => {
    tt++;
    if (tt % outputSize === 0) {
        console.log('OP/S => ', outputSize / ((new Date().getTime() - time) / 1000), 'TIME =>', (new Date().getTime() - time), data);
        time = new Date().getTime();
    } if (tt === size) {
        return true;
    }
    return false;
};

let startSmesh = async () => {
    const smesh = require('../lib/network/socket');
    let client = new smesh.Socket(null, {
        reconnect: true,
        maxReconnectionRetry: 0,
        helloMessage: 'client test'
    });
    client.on(smesh.SocketEvents.disconnect, (data) => {
        console.log('Socket disconnected', data);
    });
    client.on(smesh.SocketEvents.error, (data) => {
        console.log('Socket error', data);
    });

    client.on(smesh.SocketEvents.message, ({ data, socketId }) => {
        data = JSON.parse(data);
        // console.log('RICEVO', tt);
        let end = onData({ data, socketId });
        if (end) {
            client.close();
        }
    });
    try {
        let hello = await client.connect({ path: '../ipc/test.ipc' });
        console.log('CONNESSO', hello);
    } catch (exc) {
        console.log('ERR', exc);
    }


    let obj = getSend();
    time = new Date().getTime();
    for (let i = 0; i < size; i++) {
        // console.log('SEND', i);
        await client.send(null, obj);
        // console.log('SENDED', i);
    }

    console.log('FINITO DI INVIARE', new Date().getTime() - time);
};


let startZMQ = async () => {
    const zmqS = require('../lib/network/zeromqSocket');
    let zmq = require('zeromq-ng');
    let client = new zmqS.Socket(`Req-ServerLocalRouterSocket-${this.socketId}`, zmq.Dealer, {
        immediate: true,
        linger: 0,
        routingId: 'asss'
    }, this.config, false);


    await client.start('ipc://test.ipc', false, true, 'test');


    client.on(zmqS.SocketEvents.message, (data) => {
        data = JSON.parse(data);
        let end = onData(data);
        if (end) {
            client.close();
        }
    });

    let obj = getSend();
    time = new Date().getTime();
    console.log('START');
    for (let i = 0; i < size; i++) {
        try {
            await client.send(obj);
        } catch (exc) {
            global.logger.error('ERR', exc);
        }
    }
};

if (process.argv[2] === 'smesh') {
    startSmesh();
}
if (process.argv[2] === 'zmq') {
    startZMQ();
}
