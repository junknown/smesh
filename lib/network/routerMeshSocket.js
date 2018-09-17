const WrappedSocket = require('./wrappedSocket');

/* RouterMeshSocket ---> ServiceMeshSocket */

class RouterMeshSocket extends WrappedSocket {
    constructor(config, socketId, serverHost, serverPort) {
        super(config, socketId);
        this.serverHost = serverHost;
        this.serverPort = serverPort;
        super.initSocket();
    }


    async start() {
        await this.socket.connect({ host: this.serverHost, port: this.serverPort });
    }
}

module.exports = RouterMeshSocket;
