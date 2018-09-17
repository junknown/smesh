const dgram = require('dgram');
const { TYPES } = require('../constants');


class ServiceDiscovery {
    constructor(config, peerId) {
        this.peerId = peerId;
        this.config = config || {};
        this.multicastAddr = this.config.multicasAddr || '233.255.255.1';
        this.port = this.config.port || 20000;
        this.helloInterval = this.config.helloInterval || 5000;
    }

    send(socket, message) {
        socket.send(message, 0, message.length, this.port, this.multicastAddr);
    }

    startDiscovery(onDiscovery) {
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        socket.bind(this.port);

        socket.on('listening', () => {
            socket.addMembership(this.multicastAddr);

            const address = socket.address();
            global.logger.info(`Autodiscovery in ascolto su ${address.address}:${address.port}`);
        });
        socket.on('message', (message, rinfo) => {
            let node = JSON.parse(message);
            node.data.address = rinfo.address;
            onDiscovery(node);
        });
    }

    sendDiscovery(helloData) {
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        this.interval = setInterval(() => {
            let hello = Buffer.from(JSON.stringify({
                type: TYPES.HELLO,
                peerId: this.peerId,
                data: helloData
            }));
            this.send(socket, hello);
        }, this.helloInterval);
    }

    close() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
}

module.exports = ServiceDiscovery;
