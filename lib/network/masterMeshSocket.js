
const WrappedSocket = require('./wrappedSocket');

/* RouterMeshSocket ---> ServiceMeshSocket */
class MasterrMeshSocket extends WrappedSocket {
    constructor(config, socketId) {
        super(config, socketId);
        this.port = this.config.port;
        if (!this.config.port) {
            throw new Error('Impossibile avviare un service router senza specificare la porta!');
        }
        super.initSocket();
    }

    async start() {
        await this.socket.bind({ host: '0.0.0.0', port: this.port });
        global.logger.info(`Socket master remota ${this.socketId} bindato...`);
    }
}

module.exports = MasterrMeshSocket;
