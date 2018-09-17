const Path = require('path');
const WrappedSocket = require('./wrappedSocket');


/* ClientRouterSocket ---> RouterLocalSocket */

class ClientRouterSocket extends WrappedSocket {
    constructor(config, socketId, serverName) {
        super(config, socketId);
        this.serverName = serverName;
        this.ipcPath = this.config.ipcPath || Path.join(__dirname, '../../ipc');
        this.ipcPath = Path.join(this.ipcPath, `${this.serverName}.ipc`);
        super.initSocket({ reconnect: true });
    }

    async start() {
        await this.socket.connect({ path: this.ipcPath });
    }
}

module.exports = ClientRouterSocket;
