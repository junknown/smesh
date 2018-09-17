
const { TYPES } = require('./constants');
const RpcManager = require('./rpcmanager');
const ClientSocket = require('./network/routerLocalSocket');
const ServiceSocket = require('./network/routerMeshSocket');

const ServiceDiscovery = require('./discovery/serviceDiscovery');
const PeerList = require('./structures/peerList');

class Router {
    constructor(routerName, config = {}) {
        this.config = config;
        this.config.options = this.config.options || {};
        this.processId = routerName;
        this.machineId = process.env.MACHINE_ID;
        this.localSocket = new ClientSocket(this.config.socket, this.processId);

        this.serviceDiscovery = new ServiceDiscovery(this.config.discovery, this.machineId);

        this.peerList = new PeerList();
        this.rpcManager = new RpcManager(config.rpcManager);
    }

    async _onPeerUpdateChannels(peer, status, channels) {
        let hasChange = this.peerList.indexPeer(peer.id, status, channels);
        if (hasChange) {
            await this._sendChannels();
        }
    }

    async _onNewRemotePeer(peerId, helloData) {
        let peer = {
            id: peerId,
            channels: helloData.channels,
            status: helloData.status
        };
        try {
            let existingPeer = this.peerList.getPeer(peer.id);
            if (!existingPeer || !existingPeer.socket) {
                peer.socket = new ServiceSocket(this.config.remoteSocket, `${this.processId}(${this.machineId})->${peerId}`, helloData.address, helloData.port);
                peer.socket.onMessage(async (msg, from) => {
                    if (msg.type === TYPES.REPLY) {
                        await this.rpcManager.onReply(msg, from);
                    }
                    if (msg.type === TYPES.CHANNELS_INFO) {
                        await this._onPeerUpdateChannels(peer, msg.status, msg.channels);
                    }
                });
                peer.socket.onDisconnected(async () => {
                    global.logger.info(`Master remoto ${peer.id} disconnesso!`);
                    this._sendChannels().catch((err) => {
                        global.logger.error("Impossibile inviare l/'aggiornamento dei cluster", err);
                    });
                    peer.socket.close();
                    this.peerList.removePeer(peer);
                    this.rpcManager.dropPendingRpc(peer.id);
                });
                await peer.socket.start();
                global.logger.info(`Master remoto ${peer.id} connesso!`);
                this.peerList.insertPeer(peer);
            }
        } catch (err) {
            if (peer.socket) {
                peer.socket.close();
            }
            global.logger.error(`Errore nella connessione con il router ${peer.id} `, err);
        }
    }

    async _handleRpc(message, from) {
        this.rpcManager.onRpc(message, from, this.localSocket, async () => {
            let peer = this.peerList.getBestPeer(message.channel);
            if (peer) {
                this.peerList.usePeer(peer.id);
                let res = await this.rpcManager.launchRpc(peer.socket, message, null);
                return res;
            } else if (!message.volatile) {
                let error = new Error(`Non è stato trovato nessun service con il canale ${message.channel} per il messaggio ${message.tid}`);
                error.canRetry = true;
                throw error;
            } else return null;
        });
    }

    async _sendChannels(to) {
        let msg = { type: TYPES.CHANNELS_INFO, channels: this.peerList.getChannels() };
        if (to) {
            await this.localSocket.send(to, msg);
        } else {
            await this.localSocket.broadcast(msg);
        }
    }

    async start() {
        this.serviceDiscovery.startDiscovery((packet) => {
            this._onNewRemotePeer(packet.peerId, packet.data);
        });

        this.localSocket.onMessage(async (msg, from) => {
            if (msg.type === TYPES.RPC) {
                await this._handleRpc(msg, from);
            }
        });


        this.localSocket.onAccept((socketId) => {
            this._sendChannels(socketId);
        });
        await this.localSocket.start();
    }


    close() {
        this.localSocket.close();
    }
}

module.exports = Router;
