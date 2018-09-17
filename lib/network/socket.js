
const Net = require('net');
const Util = require('util');
const Shortid = require('shortid');
const Emitter = require('../utils/asyncEmitter');
const fs = require('fs-extra');
const Deferred = require('../utils/deferred');
const WaitingQueue = require('../structures/waitingQueue');
const { TYPES } = require('../constants');
const { TransformationStream, Encoder } = require('./protocol/protocol');

const SocketEvents = {
    message: '0',
    errorReceive: '-1',
    error: '-2',
    timeout: '-3',
    disconnect: '1',
    accept: '2',
    ready: '3'
};

class Socket extends Emitter {
    constructor(socketId, config = {}) {
        super();
        this.config = config;
        this.sockets = {};

        this.socketId = socketId || Shortid.generate();
        this.config.maxBufferSize = this.config.maxBufferSize || 0;
        this.config.keepAlive = this.config.keepAlive || 200;
        this.config.maxReconnectionRetry = this.config.maxReconnectionRetry || 0;
        this.config.reconnect = this.config.reconnect || false;
        this.config.reconnectDelay = this.config.reconnectDelay || 10000;
        this.config.maxPendingWrite = this.config.maxPendingWrite || 0;

        this.helloMessage = config.helloMessage;
        this.reconnetRetry = 0;
        this._manualClose = false;
        this.firstConnect = true;
    }

    async bind(params) {
        this.server = Net.createServer(this.onNewConnection.bind(this));

        this.server.listenAsync = Util.promisify(this.server.listen.bind(this.server));
        if (params.path) {
            await fs.remove(params.path);
        }

        this.server.listen(params);
    }


    onNewConnection(newSock) {
        global.logger.info(`Socket ${this.socketId}: Una nuova socket richiede la connessione sulla socket ...`);
        this.initializeSocket(newSock, false);
    }

    connect(options) {
        this._manualClose = false;
        if (!this.reconnectPromise) {
            this.reconnectPromise = new Deferred();
        }

        this._lastConnectOptions = options;

        let connectionErrorHandler = (exc) => {
            if (exc.code === 'ECONNREFUSED') {
                if (!this.firstConnect) {
                    global.logger.error(`Socket ${this.socketId}: Impossibile connettersi...`);
                }

                if (!this._reconnect()) {
                    this.reconnectPromise.reject(exc);
                    this.reconnectPromise = null;
                }
            }
        };

        let _connect = () => {
            this.client.removeListener('error', connectionErrorHandler);
            global.logger.info(`Socket ${this.socketId}: Connesso al server. In atteso di HELLO...`);
            this.firstConnect = false;
            this.initializeSocket(this.client);
        };
        this.client = Net.createConnection(options, _connect);
        this.client.once('error', connectionErrorHandler);

        return this.reconnectPromise.wait();
    }

    _reconnect() {
        if (!this.config.reconnect) return false;
        if (this.config.maxReconnectionRetry === 0 || this.reconnetRetry < this.config.maxReconnectionRetry) {
            if (!this.firstConnect) {
                global.logger.debug(`Socket ${this.socketId}: Tentativo di riconnessione nr. ${this.reconnetRetry}. Attendo ${this.config.reconnectDelay / 1000}s per la riconnessione...`);
            }
            if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(() => {
                this.reconnectTimeout = null;
                if (!this.firstConnect) {
                    global.logger.debug(`Socket ${this.socketId}: Reconnecting...`);
                }
                this.reconnetRetry++;
                this.connect(this._lastConnectOptions);
            }, this.config.reconnectDelay);
            return true;
        } else {
            return false;
        }
    }

    startKeepAlive(socket) {
        this.stopKeepAlive(socket);
        socket._keepAliveInterval = setInterval(() => {
            if (socket._lastWrite + this.config.keepAlive < new Date().getTime()) {
                Encoder.writeKeepAlive(socket);
            }
        }, this.config.keepAlive);
    }

    stopKeepAlive(socket) {
        if (socket._keepAliveInterval) {
            clearInterval(socket._keepAliveInterval);
            socket._keepAliveInterval = null;
        }
    }


    sendHello(socket) {
        global.logger.debug(`Socket ${this.socketId}: Invio HELLO message...`);

        return this._send(TYPES.HELLO, JSON.stringify({
            socketId: this.socketId,
            hello: this.helloMessage
        }), true, socket);
    }

    async handleHello(socket, data) {
        let isClient = socket === this.client;
        data = JSON.parse(data, 'utf8');
        socket._socketId = data.socketId;
        socket._hello = data.hello;
        global.logger.debug(`Socket ${this.socketId}: HELLO arrivato da ${socket._socketId}`);


        if (!isClient) {
            this.sockets[socket._socketId] = socket;
            this.emit(SocketEvents.accept, { socketId: data.socketId });
        } else if (this.reconnectPromise) {
            if (this.reconnectTimeout) {
                this.reconnectTimeout = null;
                clearTimeout(this.reconnectTimeout);
            }
            try {
                await this.sendHello(socket);
                this.emit(SocketEvents.ready, { socketId: data.socketId });
                this.reconnetRetry = 0;
                global.logger.info(`Socket ${this.socketId}: Client connesso!`);
                this.reconnectPromise.resolve(data);
                this.reconnectPromise = null;
            } catch (exc) {
                this.reconnectPromise.reject(exc);
                this.reconnectPromise = null;
            }
        }
    }

    initializeSocket(socket) {
        let isClient = socket === this.client;
        this._nmessage = 0;
        socket._closed = false;
        socket._lastWrite = new Date().getTime();
        socket._pendingWritePromises = [];


        if (this.config.noDelay) {
            global.logger.info(`Socket ${this.socketId}: Setto la socket ${isClient ? 'client' : 'server'} ${this.socketId} in NO_DELAY`);
            socket.setNoDelay(true);
        }


        if (this.config.keepAlive) {
            global.logger.info(`Socket ${this.socketId}: Inizializzo keep alive per la socket ${isClient ? 'client' : 'server'} ${this.socketId} `);
            this.startKeepAlive(socket);
        }

        socket.on('close', () => {
            socket._closed = true;
            socket.destroy();
            if (socket._keepAliveInterval) {
                this.stopKeepAlive(socket);
            }
            if (!isClient && this.sockets[socket._socketId]) {
                delete this.sockets[socket._socketId];
            }
            if (isClient && !this._manualClose) {
                this._reconnect();
            }
            this.emit(SocketEvents.disconnect, { socketId: socket._socketId });
        });


        socket.transformStream = new TransformationStream(async (data, header, isSystem) => {
            if (isSystem) {
                if (header.toString('utf8') === TYPES.HELLO) {
                    await this.handleHello(socket, data);
                }
            } else {
                await this.emitAsync(SocketEvents.message, { data, header, socketId: socket._socketId }, false);
            }
        });
        socket.pipe(socket.transformStream);
        socket.on('end', () => {
            socket.transformStream.end();
            socket.end();
            delete socket.transformStream;
            if (!isClient && this.sockets[socket._socketId]) {
                delete this.sockets[socket._socketId];
            }
            socket.destroy();
        });
        socket.on('timeout', () => {
            this.emit(SocketEvents.timeout, { socketId: socket._socketId });
            socket.destroy();
        });
        socket.on('error', (err) => {
            for (let i = 0; i < socket._pendingWritePromises.length; i++) {
                socket._pendingWritePromises[i].reject();
            }
            socket._pendingWritePromises = [];
            this.emit(SocketEvents.error, { err, socketId: socket._socketId });
        });

        socket.on('drain', () => {
            for (let i = 0; i < socket._pendingWritePromises.length; i++) {
                socket._pendingWritePromises[i].resolve();
            }
            socket._pendingWritePromises = [];
        });

        socket._waitingForWrite = new WaitingQueue();

        if (!isClient) {
            this.sendHello(socket).catch((err) => {
                global.logger.error(`Socket ${this.socketId}: Errore nell'invio dell'HELLO`, err);
                socket.destroy();
            });
        }
    }


    async _send(header, payload, system = false, socket) {
        if (!socket) throw new Error(`Socket ${this.socketId}: Tentativo di write su socket ${socket._socketId} non inizializzata`);
        if (socket._closed) throw new Error(`Socket ${this.socketId}: Tentativo di write su socket ${socket._socketId} chiusa`);
        if (this.config.maxPendingWrite && socket._waitingForWrite.size > this.config.maxPendingWrite) {
            throw new Error(`Socket ${this.socketId}: Superato il limite di max ${this.config.maxPendingWrite} scritture pendenti contemporanee sulla socket ${socket._socketId}`);
        }
        socket._lastWrite = new Date().getTime();


        let waitPromise = socket._waitingForWrite.wait();
        if (waitPromise) {
            await waitPromise;
        }

        let ok = Encoder.write(socket, payload, header, system);
        payload = null;
        header = null;

        if (!ok && socket.bufferSize > this.config.maxBufferSize) {
            let defer = new Deferred();
            socket._pendingWritePromises.push(defer);
            await defer.wait();
        }
        socket._waitingForWrite.next();
    }

    send(header, payload, socketId) {
        let socket = this.client;
        if (socketId !== undefined && socketId !== null) socket = this.sockets[socketId];
        return this._send(header, payload, false, socket);
    }

    broadcast(header, payload) {
        let sockets = Object.values(this.sockets);
        let promises = [];
        for (let i = 0; i < sockets.length; i++) {
            promises.push(this._send(header, payload, false, sockets[i]));
        }
        return Promise.all(promises);
    }


    close() {
        this._manualClose = true;
        if (this.client) {
            this.client.destroy();
        }
        if (this.server) {
            this.server.close();
        }
        for (let socketId in this.sockets) {
            this.sockets[socketId].destroy();
        }
    }

    getAcceptedSocket(socketId) {
        return this.sockets[socketId];
    }
}


module.exports = { Socket, SocketEvents };
