const { TYPES } = require('./constants');
const Deferred = require('./utils/deferred');
const shortid = require('shortid');

class RpcManager {
    constructor(config = {}) {
        this.waitingResponses = {};
        config.options = config.options || {};
    }

    async _sendErrorReply(socket, from, message, error) {
        global.logger.error(`Errore nella chiamata rpc ${message.tid}`, error);
        try {
            await socket.send(from, { type: TYPES.REPLY, error: { canRetry: error.canRetry, message: error.message }, tid: message.tid });
        } catch (exc) {
            global.logger.error(`Errore nella chiamata rpc ${message.tid}`, exc);
        }
    }

    async onRpc(message, from, replySocket, peerList, routerSocket) {
        this.pendingRpc++;
        global.logger.debug(`Nuovo RPC con tid ${message.tid} da ${from}`);

        if (this.pendingRpc === this.MAX_PENDING_RPC && this.MAX_PENDING_RPC > 0) {
            global.logger.warn(`Attenzione più di ${this.MAX_PENDING_RPC} richieste in coda`);
        }

        console.log('MAPQUEUE BEFORE BEST PEER');
        let peer = await peerList.waitForBestPeer(message.channel, message.volatile);
        console.log('MAPQUEUE AFTER BEST PEER');
        if (peer) {
            let to = peer.id;
            if (!routerSocket) {
                // se non ho inserito il routerSocket allora è un client che si connette ad un server, quindi to =null e socket = alla socket del peer
                routerSocket = peer.socket;
            }

            peerList.unsetReady(peer.id);
            this._sendRpc(routerSocket, message, to).then((deferred) => {
                console.log('MAPQUEUE IN THEN', deferred);

                peerList.setReady(peer.id);
                console.log('MAPQUEUE DEFERERD', deferred);
                if (deferred) {
                    deferred.wait().then((resp) => {
                        console.log('MAPQUEUE PROMISE??', resp);
                        return replySocket.send(from, { type: TYPES.REPLY, resp, tid: message.tid }).catch((exc) => {
                            global.logger.error('Errore nella risposta rpc', exc);
                        });
                    }).catch(async (error) => {
                        await this._sendErrorReply(replySocket, from, message, error);
                    });
                    console.log('MAPQUEUE DOPO DEFERERD');
                }
            }).catch(async (err) => {
                peerList.setReady(peer.id);
                await this._sendErrorReply(replySocket, from, message, err);
            });
        } else if (!message.volatile) {
            let error = new Error(`Non è stato trovato nessun service con il canale ${message.channel} per il messaggio ${message.tid}`);
            error.canRetry = true;
            await this._sendErrorReply(replySocket, from, message, error);
        }

        this.pendingRpc--;
    }

    onReply(message, from) {
        if (this.waitingResponses[message.tid]) {
            if (message.error) {
                this.waitingResponses[message.tid].reject(message.error);
                global.logger.debug(`Chiamata ${message.tid} terminata con errore`);
            } else {
                this.waitingResponses[message.tid].resolve(message.resp);
                global.logger.debug(`Chiamata ${message.tid} terminata`, Object.keys(this.waitingResponses).length);
            }
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

    dropPendingRpc(socketId) {
        let error = new Error(`La socket ${socketId} è terminato inaspettatamente`);
        for (let key in this.waitingResponses) {
            if (this.waitingResponses[key].socketId === socketId) {
                this.waitingResponses[key].reject(error);
                delete this.waitingResponses[key];
            }
        }
        console.log('Terminata chiamata per drop peer', Object.keys(this.waitingResponses).length, this.waitingResponses, socketId);
    }


    async _sendRpc(socket, message, to) {
        try {
            if (!message.wait) {
                await socket.send(to, message);
            } else {
                if (this.waitingResponses[message.tid]) {
                    message = { ...message };
                    let newTid = message.tid + '_' + shortid.generate();
                    global.logger.debug(`Attenzione tid ${message.tid} duplicato! Il tid è convertito in ${newTid}`);
                    message.tid = newTid;
                }


                let d = new Deferred();
                let targetSocketId = socket.isServer ? to : socket.socketId;
                this.waitingResponses[message.tid] = {
                    resolve: d.resolve,
                    reject: d.reject,
                    socketId: targetSocketId
                };


                /* let p = new Promise((res, rej) => {
                    try {
                        this.waitingResponses[message.tid] = {
                            resolve: (result, err) => {
                                if (to) {
                                    global.logger.debug(`Chiamata ${message.tid} su ${to} terminato ${err ? 'con errore' : ''}`);
                                } else {
                                    global.logger.debug(`Chiamata ${message.tid} terminato ${err ? 'con errore' : ''}`);
                                }

                                if (err) {
                                    rej(err);
                                } else {
                                    res(result);
                                }
                            },
                            to: message.to,
                            data: message.data
                        };
                    } catch (exc) {
                        rej(exc);
                    }
                }); */
                global.logger.debug(`Effetto il routing del messaggio ${message.tid} su ${targetSocketId} `);
                await socket.send(to, message);
                return d;
            }
        } catch (exc) {
            if (this.waitingResponses[message.tid]) {
                delete this.waitingResponses[message.tid];
            }

            throw exc;
        }
    }

    async launchRpc(socket, message, to) {
        let d = await this._sendRpc(socket, message, to);
        if (d) return d.wait();
        else return undefined;
    }
}

module.exports = RpcManager;
