
const Path = require('path');
const WrappedSocket = require('./wrappedSocket');

/* ClientRouterSocket ---> RouterLocalSocket */


class MasterLocalSocket extends WrappedSocket {
    constructor(config, socketId) {
        super(config, socketId);
        this.ipcPath = this.config.ipcPath || Path.join(__dirname, '../../ipc');
        this.ipcPath = Path.join(this.ipcPath, `${this.socketId}.ipc`);
        super.initSocket();
    }

    async start() {
        await this.socket.bind({ path: this.ipcPath });
        global.logger.info(`Socket master locale del servizio ${this.socketId} bindato...`);
    }
}

module.exports = MasterLocalSocket;
