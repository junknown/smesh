const { TYPES } = require('./constants');

const shortid = require('shortid');

class RpcManager {
    constructor(config = {}) {
        this.waitingResponses = {};
        config.options = config.options || {};
    }

    async onRpc(message, from, socket, runRpc) {
        this.pendingRpc++;
        global.logger.debug(`Nuovo RPC con tid ${message.tid} da ${from}`);
        try {
            if (from.isMaster) {
                await socket.sendAck(from);
            }

            if (this.pendingRpc === this.MAX_PENDING_RPC && this.MAX_PENDING_RPC > 0) {
                global.logger.warn(`Attenzione più di ${this.MAX_PENDING_RPC} richieste in coda`);
            }
            let promise = runRpc(message, from);

            if (message.wait) {
                let resp = await promise;
                try {
                    await socket.send(from, { type: TYPES.REPLY, resp, tid: message.tid });
                } catch (exc) {
                    global.logger.error('Errore nella risposta rpc', exc);
                }
            }
        } catch (error) {
            global.logger.error(`Errore nella chiamata rpc ${message.tid}`, error);
            try {
                await socket.send(from, { type: TYPES.REPLY, error: { canRetry: error.canRetry, message: error.message }, tid: message.tid });
            } catch (exc) {
                global.logger.error(`Errore nella chiamata rpc ${message.tid}`, exc);
            }
        }
        this.pendingRpc--;
    }

    onReply(message, from) {
        if (this.waitingResponses[message.tid]) {
            this.waitingResponses[message.tid].resolve(message.resp, message.error);
            delete this.waitingResponses[message.tid];
        } else {
            global.logger.warn('Messaggio in reply non registrato!', message.tid, from);
        }
    }

    async reply(socket, to, tid, resp, error) {
        try {
            let msgResp = {
                type: TYPES.REPLY,
                tid,
                error,
                resp
            };
            await socket.send(to, msgResp);
        } catch (exc) {
            global.logger.error("Errore nell'invio della risposta..", exc);
        }
    }

    dropPendingRpc(peerId) {
        for (let key in this.waitingResponses) {
            if (this.waitingResponses[key].to === peerId) {
                this.waitingResponses[key].resolve(null, `Il peer ${peerId} è terminato inaspettatamente`);
                delete this.waitingResponses[key];
            }
        }
    }

    async launchRpc(socket, message, to) {
        if (!message.wait) {
            await socket.send(to, message);
            return undefined;
        } else {
            if (this.waitingResponses[message.tid]) {
                message = { ...message };
                let newTid = message.tid + '_' + shortid.generate();
                global.logger.debug(`Attenzione tid ${message.tid} duplicato! Il tid è convertito in ${newTid}`);
                message.tid = newTid;
            }
            let p = new Promise((resolve, reject) => {
                try {
                    this.waitingResponses[message.tid] = {
                        resolve: (result, err) => {
                            global.logger.debug(`Chiamata ${message.tid} su ${to} terminato ${err ? 'con errore' : ''}`);
                            if (err) {
                                reject(err);
                            } else {
                                resolve(result);
                            }
                        },
                        to: message.to,
                        data: message.data
                    };
                } catch (exc) {
                    reject(exc);
                }
            });
            try {
                await socket.send(to, message);
            } catch (exc) {
                if (this.waitingResponses[message.tid]) {
                    delete this.waitingResponses[message.tid];
                }
                throw exc;
            }
            let res = await p;
            return res;
        }
    }
}

module.exports = RpcManager;
