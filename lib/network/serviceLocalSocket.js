
const Path = require('path');
const WrappedSocket = require('./wrappedSocket');


/* ClientRouterSocket ---> RouterLocalSocket */

class ServiceLocalSocket extends WrappedSocket {
    constructor(config, socketId, serverName) {
        super(config, socketId);
        this.serverName = serverName;
        super.initSocket({ reconnect: true });
        this.ipcPath = this.config.ipcPath || Path.join(__dirname, '../../ipc');
        this.ipcPath = Path.join(this.ipcPath, `${this.serverName}.ipc`);
    }

    async start() {
        await this.socket.connect({ path: this.ipcPath });
    }
}

module.exports = ServiceLocalSocket;
