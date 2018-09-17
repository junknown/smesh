
const { TYPES } = require('./constants');

const RpcManager = require('./rpcmanager');
const MeshSocket = require('./network/masterMeshSocket');
const LocalSocket = require('./network/masterLocalSocket');

const ServiceDiscovery = require('./discovery/serviceDiscovery');
const PeerList = require('./structures/peerList');

class Master {
    constructor(serviceName, config = {}) {
        this.config = config;
        this.config.options = this.config.options || {};
        this.serviceName = serviceName;
        this.machineId = process.env.MACHINE_ID;
        this.meshSocket = new MeshSocket(this.config.meshSocket, `${this.serviceName}(${this.machineId})`);
        this.localSocket = new LocalSocket(this.config.localSocket, this.serviceName);


        this.serviceDiscovery = new ServiceDiscovery(this.config.discovery, this.meshSocket.socketId);
        this.helloData = {
            port: this.meshSocket.port,
            status: 0
        };

        this.status = 0;
        this.peerList = new PeerList();
        this.rpcManager = new RpcManager(config.rpcManager);
    }

    async _handleRpc(message, from) {
        this.rpcManager.onRpc(message, from, this.meshSocket, async () => {
            let peer = this.peerList.getBestPeer(message.channel);
            if (peer) {
                this.peerList.usePeer(peer.id);
                let res = await this.rpcManager.launchRpc(this.localSocket, message, peer.id);
                return res;
            } else if (!message.volatile) {
                let error = new Error(`Non è stato trovato nessun service con il canale ${message.channel} per il messaggio ${message.tid}`);
                error.canRetry = true;
                throw error;
            } else return null;
        });
    }

    async _sendChannels(to) {
        let msg = { type: TYPES.CHANNELS_INFO, channels: this.peerList.getChannels(), status: this.status };
        if (to) {
            await this.meshSocket.send(to, msg);
        } else {
            await this.meshSocket.broadcast(msg);
        }
    }


    _onUpdatePeers(peerId, status, channels) {
        let peer = this.peerList.getPeer(peerId);
        if (!peer) {
            peer = {
                id: peerId
            };
            this.peerList.insertPeer(peer);
        }
        let hasChange = this.peerList.indexPeer(peerId, status, channels);
        if (hasChange) {
            this.status++;
            this._sendChannels().catch((err) => {
                global.logger.error('Errore nell\' inviare gli aggiornamenti sui channels', err);
            });
        }
    }


    async _startMeshSocket() {
        this.serviceDiscovery.sendDiscovery(this.helloData);
        this.meshSocket.onMessage(async (msg, from) => {
            if (msg.type === TYPES.RPC) {
                await this._handleRpc(msg, from);
            }
        });

        this.meshSocket.onAccept((socketId) => {
            this._sendChannels(socketId).catch((err) => {
                global.logger.error("Impossibile inviare l/'aggiornamento dei cluster", err);
            });
            global.logger.info(`Router ${socketId} connesso...`);
        });
        await this.meshSocket.start();
    }

    async _startLocalSocket() {
        this.localSocket.onDisconnected((socketId) => {
            global.logger.info(`Service locale ${socketId} disconnesso...`);
            this.rpcManager.dropPendingRpc(socketId);
            this.peerList.removePeer({ id: socketId });
            this.status++;
            this._sendChannels().catch((err) => {
                global.logger.error("Impossibile inviare l/'aggiornamento dei cluster", err);
            });
        });
        this.localSocket.onAccept((socketId) => {
            global.logger.info(`Service locale ${socketId} connesso...`);
        });
        this.localSocket.onMessage(async (msg, from) => {
            if (msg.type === TYPES.CHANNELS_INFO) {
                this._onUpdatePeers(from, msg.status, msg.channels);
            }
            if (msg.type === TYPES.REPLY) {
                await this.rpcManager.onReply(msg, from);
            }
        });
        await this.localSocket.start();
    }

    async start() {
        await this._startMeshSocket();
        await this._startLocalSocket();
    }


    close() {
        this.serviceDiscovery.close();
        this.meshSocket.close();
        this.localSocket.close();
    }
}

module.exports = Master;
