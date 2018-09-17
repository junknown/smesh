const Path = require('path');
const WrappedSocket = require('./wrappedSocket');

/* ClientRouterSocket ---> RouterLocalSocket */


class RouterLocalSocket extends WrappedSocket {
    constructor(config, socketId) {
        super(config, socketId);
        super.initSocket();
        this.ipcPath = this.config.ipcPath || Path.join(__dirname, '../../ipc');
        this.ipcPath = Path.join(this.ipcPath, `${this.socketId}.ipc`);
    }


    async start() {
        await this.socket.bind({ path: this.ipcPath });
        global.logger.info(`Socket Router locale ${this.socketId} bindato...`);
    }
}

module.exports = RouterLocalSocket;
