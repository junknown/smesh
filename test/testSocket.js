
const GlobalLogger = require('global-logger');

process.env.LOG_LEVEL = 'INFO';
global.logger = GlobalLogger({ LOG_LEVEL: process.env.LOG_LEVEL || 'INFO', SUFFIX: 'Main' });

function getResp() {
    return JSON.stringify({ b: 'cbbb' });
}
let tt = 0;
let startSmesh = async () => {
    const { Socket, SocketEvents } = require('../lib/network/socket');
    const Deferred = require('../lib/utils/deferred');

    let server = new Socket('server', { helloMessage: 'test' });


    await server.bind({ path: '../ipc/test.ipc' });


    server.on(SocketEvents.disconnect, (data) => {
        console.log('Socket disconnected', data);
    });
    server.on(SocketEvents.error, (data) => {
        console.log('Socket error', data);
    });

    server.on(SocketEvents.message, async ({ data, header, socketId }) => {
        await server.send(null, getResp(), socketId);
    });
};

let startTCPFast = async () => {
    let Socket = require('fast-tcp').Socket;
    let Server = require('fast-tcp').Server;

    const fs = require('fs-extra');
    await fs.remove('../ipc/test.ipc');
    let server = new Server();
    server.listen({ path: '../ipc/test.ipc' });

    server.on('connection', (socket) => {
        socket.on('test', (data) => {
            socket.emit('test', getResp());
        });
    });
};
let startZMQ = async () => {
    const { Socket, SocketEvents } = require('../lib/network/zeromqSocket');
    let zmq = require('zeromq-ng');
    let server = new Socket(`Res-ClientLocalRouterSocket-${this.socketId}`, zmq.Router, {
        immediate: true,
        mandatory: true,
        linger: 0
    }, this.config, false);


    await server.start('ipc://test.ipc', true, true);


    server.on(SocketEvents.message, async (data) => {
        let [id, msg] = data;
        await server.send([id.toString('UTF-8'), getResp()]);
    });
};


if (process.argv[2] === 'smesh') {
    startSmesh();
}
if (process.argv[2] === 'zmq') {
    startZMQ();
}

if (process.argv[2] === 'fast') {
    startTCPFast();
}
