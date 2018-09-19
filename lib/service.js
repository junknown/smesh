
const { TYPES } = require('./constants');
const shortid = require('shortid');
const Socket = require('./network/serviceLocalSocket');
const RpcManager = require('./rpcmanager');


class Service {
    constructor(serviceName, config = {}) {
        this.config = config;
        this.config.options = this.config.options || {};
        this.serviceName = serviceName;
        this.channels = {};
        this.machineId = process.env.MACHINE_ID;
        this.processId = `service-${shortid.generate()}-${this.serviceName}(${this.machineId})`;
        this.socket = new Socket(this.config.socket, this.processId, serviceName);
        this.rpcManager = new RpcManager(config.rpcManager);
        this.status = 0;
    }


    updateChannels(channels) {
        this.channels = channels;
        this.status++;
    }

    register(channel, fnc) {
        this.channels[channel] = fnc;
    }

    unregister(channel) {
        if (this.channels[channel]) {
            delete this.channels[channel];
        }
    }

    async handleRpc(msg) {
        let data;
        let error;
        let handler = this.channels[msg.channel];
        let params = JSON.parse(msg.data).params;
        if (msg.wait) {
            try {
                if (!handler) {
                    throw new Error("Nessuna callback per l'evento inviato");
                } else {
                    data = await handler(params);
                }
            } catch (err) {
                error = err;
            }
            await this.rpcManager.reply(this.socket, null, msg.tid, data, error);
        } else if (handler) {
            await handler(params).catch((err) => { });
        }
    }

    async start() {
        this.socket.onMessage(async (msg, from) => {
            if (msg.type === TYPES.RPC) {
                await this.handleRpc(msg);
            }
        });

        this.socket.onDisconnected(() => {
            global.logger.error(`Master ${this.serviceName} disconnesso...`);
            if (this.onDisconnectHandler) {
                this.onDisconnectHandler();
            }
        });


        this.socket.onReady(() => {
            // richiamato alla prima connessione e ad ogni riconnessione
            this.socket.send(null, {
                type: TYPES.CHANNELS_INFO,
                channels: Object.keys(this.channels),
                status: this.status
            });
        });

        global.logger.info(`In connessione al master ${this.serviceName}...`);
        await this.socket.start();
        global.logger.info(`Connesso al master ${this.serviceName}`);
    }

    onDisconnect(func) {
        this.onDisconnectHandler = func;
    }

    close() {
        this.socket.close();
    }
}

module.exports = Service;
