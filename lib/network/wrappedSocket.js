
const { Socket, SocketEvents } = require('./socket');


class WrappedSocket {
    constructor(config, socketId) {
        this.config = config || {};
        this.socketId = socketId;
    }

    initSocket(socketConfig) {
        this.socket = new Socket(this.socketId, socketConfig);
    }

    close() {
        if (this.socket) {
            this.socket.close();
        }
    }

    getAcceptedSocekt(socketId) {
        return this.socket.getAcceptedSocket(socketId);
    }

    onMessage(func) {
        this.socket.on(SocketEvents.message, async (msg) => {
            let msgJson;
            try {
                msgJson = JSON.parse(msg.data, 'utf8');
            } catch (exc) {
                global.logger.error('Errore nel parsare il messaggio!!', msg.data.toString('utf8'));
            }

            await func(msgJson, msg.socketId);
        });
    }

    onAccept(func) {
        this.socket.on(SocketEvents.accept, (msg) => {
            func(msg.socketId);
        });
    }

    onError(func) {
        this.socket.on(SocketEvents.error, (msg) => {
            func(msg.socketId, msg.err);
        });
    }

    onDisconnected(func) {
        this.socket.on(SocketEvents.disconnect, (msg) => {
            func(msg.socketId);
        });
    }

    onReady(func) {
        this.socket.on(SocketEvents.ready, (msg) => {
            func(msg.socketId);
        });
    }

    send(to, message, header) {
        let headerPkg = header ? JSON.stringify(header) : undefined;
        let messagePkg = JSON.stringify(message);

        return this.socket.send(headerPkg, messagePkg, to);
    }

    broadcast(message, header) {
        let headerPkg = header ? JSON.stringify(header) : undefined;
        let messagePkg = JSON.stringify(message);
        return this.socket.broadcast(headerPkg, messagePkg);
    }
}

module.exports = WrappedSocket;
