
const { TYPES } = require('./constants');
const shortid = require('shortid');

const RpcManager = require('./rpcmanager');
const Socket = require('./network/clientRouterSocket');
const DeferredPromise = require('./utils/deferred');

class ClusterClient {
    constructor(routerName, config = {}) {
        this.config = config;
        this.config.options = this.config.options || {};
        this.routerName = routerName;
        this.machineId = process.env.MACHINE_ID;
        this.processId = `client-${shortid.generate()}-${this.routerName}(${this.machineId})`;
        this.socket = new Socket(this.config.socket, this.processId, routerName);
        this.rpcManager = new RpcManager(config.rpcManager);
    }

    /* gestisce i cambi di channel da parte del router. Utile in fase di avvio per aspettare determinati canali */
    _handleChannelInfo(msg) {
        if (this.waitingPromise) {
            for (let i = 0; i < this.config.waitChannels.length; i++) {
                let ch = this.config.waitChannels[i];
                if (msg.channels.indexOf(ch) < 0) {
                    return;
                }
            }
            this.waitingPromise.resolve();
            this.waitingPromise = null;
        }
    }

    /* Avvia e connette il client */
    async start() {
        this.waitingPromise = new DeferredPromise();
        this.socket.onMessage((msg) => {
            if (msg.type === TYPES.CHANNELS_INFO) {
                this._handleChannelInfo(msg);
            }
            if (msg.type === TYPES.REPLY) {
                this.rpcManager.onReply(msg, this.routerName);
            }
        });

        this.socket.onDisconnected((peerId) => {
            global.logger.error(`Router ${this.routerName} disconnesso...`);
            this.rpcManager.dropPendingRpc(peerId);
            if (this.onDisconnectHandler) {
                this.onDisconnectHandler();
            }
            this.waitingPromise = new DeferredPromise();
        });


        global.logger.info(`In connessione al router ${this.routerName}...`);

        await this.socket.start();

        global.logger.info(`Connesso al router ${this.routerName}`);


        if (this.config.waitChannels) {
            global.logger.info(`Aspetto i canali [ ${this.config.waitChannels} ] per  il router ${this.routerName}`);
            await this.waitingPromise.wait();
        }
        if (this.onConnectHandler) {
            this.onConnectHandler();
        }
        global.logger.info(`Client per router ${this.routerName} attivo`);

        this.socket.onReady(async () => {
            if (this.config.waitChannels) {
                global.logger.info(`Aspetto i canali [ ${this.config.waitChannels} ] per  il router ${this.routerName}`);
                await this.waitingPromise.wait();
                if (this.onConnectHandler) {
                    this.onConnectHandler();
                }
            }
        });
    }

    /* Effetta una una remote procedure call */
    async execute(channel, params, {
        id, wait, peerPreference
    } = {}) {
        let message = {};
        message.type = TYPES.RPC;
        message.tid = id === undefined ? shortid.generate() : id;
        message.wait = wait === undefined ? true : wait;
        message.channel = channel;
        message.peerPreference = peerPreference;
        message.data = JSON.stringify({
            params
        });
        message.from = {
            machineId: this.machineId,
            processId: this.processId
        };
        global.logger.debug(`Chiamato RPC ${channel} con id ${message.tid}`);
        try {
            let promise = this.rpcManager.launchRpc(this.socket, message);
            let ret = await promise;
            global.logger.debug(`RPC ${channel} con id ${message.tid} è concluso`);
            return ret;
        } catch (exc) {
            global.logger.error(`RPC ${channel} con id ${message.tid} è concluso con errore: `, exc);
            throw exc;
        }
    }


    onDisconnect(func) {
        this.onDisconnectHandler = func;
    }

    onConnect(func) {
        this.onConnectHandler = func;
    }

    close() {
        this.socket.close();
    }
}

module.exports = ClusterClient;
