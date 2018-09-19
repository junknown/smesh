let zmq = require('zeromq-ng');
const AsyncEmitter = require('../utils/asyncEmitter');

const SocketEvents = {
    message: '0',
    errorReceive: '-1',
    disconnect: '1',
    accept: '2'
};

class Socket extends AsyncEmitter {
    constructor(socketName, Type, config = {}, userConfig = {}, monitor = false) {
        super();
        this.SocketType = Type;
        this.socketName = socketName;
        this._setSocketConfig(config, userConfig.zeromq);
        this.hasMonitor = monitor;
        this.initialized = false;
    }

    _setSocketConfig(config = {}, userConfig = {}) {
        this.socketConfig = { ...userConfig, ...config };
    }

    initializeSocket() {
        this.socket = new this.SocketType(this.socketConfig);

        if (this.hasMonitor) {
            this.monitor = new zmq.Observer(this.socket);
            this.monitor.on('disconnect', (a, b, c) => {
                global.logger.info(`E' arrivato evento di disconnessione per la socket ${this.socketName}...`, a, b, c);
                this.emit(SocketEvents.disconnect);
            });
        } else {
            this.socket.events.on('disconnect', (a, b, c) => {
                global.logger.info(`E' arrivato evento di disconnessione per la socket ${this.socketName}...`, a, b, c);
                this.emit(SocketEvents.disconnect);
            });
        }
        this.initialized = true;
    }

    async restart() {
        global.logger.warn(`Attenzione, restart della socket ${this.socketName}...`);
        this.close();

        this.initializeSocket();
        await this.start();
    }

    async start(url, server = false, toReceive = false, socketId) {
        if (!this.initialized) {
            this.initializeSocket();
        }
        this.url = url;
        this.toReceive = toReceive;
        this.server = server;
        if (this.server) {
            this.socket.events.on('accept', () => {
                this.emit(SocketEvents.accept);
            });
            await this.socket.bind(this.url);
        } else {
            if (socketId !== undefined) {
                socketId = { routingId: socketId };
            }
            await this.socket.connect(this.url);
        }

        if (toReceive) {
            this.receivePromise = this.startReceive();
        }
    }

    async startReceive() {
        while (!this.socket.closed) {
            try {
                const msg = await this.socket.receive();
                try {
                    await this.emitAsync(SocketEvents.message, msg, false);
                } catch (exc) {
                    global.logger.error(`Errore nel gestire il messaggio dalla socket ${this.socketName}... `, msg, exc);
                }
            } catch (exc) {
                if (!this.socket || this.socket.closed) return;
                global.logger.error(`Errore nella receive della socket ${this.socketName}... `, exc);
                this.emit(SocketEvents.errorReceive, exc);
            }
        }
        global.logger.info(`Receive closed della socket ${this.socketName}`);
    }

    close() {
        if (!this.initialized) return;
        try {
            this.socket.close();
        } catch (exc) {
            global.logger.warn('Warn errore nella close', exc);
        }
        if (this.hasMonitor) {
            this.monitor.close();
        }
    }

    async send(message) {
        try {
            await this.socket.send(message);
        } catch (exc) {
            if (exc && (exc.code === 'EAGAIN'
                || exc.code === 'EFSM'
                || exc.code === 'EINTR'
                || exc.code === 'EHOSTUNREACH')) {
                exc.retry = true;
            }
            throw exc;
        }
    }
}

module.exports = { Socket, SocketEvents };
