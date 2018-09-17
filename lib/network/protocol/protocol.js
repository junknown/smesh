const stream = require('stream');
const async = require('async');

const OP_TYPES = {
    KEEP_ALIVE: 0,
    WITH_HEADER: 1,
    WITHOUT_HEADER: 2,
    SYSTEM: 3
};

const STEPS = {
    OP_TYPE: 0,
    HEADER_LENGTH: 1,
    HEADER: 2,
    PAYLOAD_LENGTH: 3,
    PAYLOAD: 4
};


/*
*  PROTOCOLLO
*  [ OP_TYPE (1) ][ HEADER_LENGTH (OPZ,4) ][ HEADER (OPZ,HEADER_LENGTH)][ PAYLOAD_LENGTH(OPZ,4)][PAYLOAD (OPZ,PAYLOAD_LENGTH)]
*  OP_TYPES può essere:
*  -- KEEP_ALIVE ( pacchetto di sistema che viene scartato senza header ne payload)
*  -- WITH_HEADER con un HEADER_LENGTH , HEADER, PAYLOAD_HEADER E PAYLOAD
*  -- WITHOUT_HEADER con PAYLOAD_HEADER E PAYLOAD
*  Le LENGHT sono UINT 4 BYTE Little Endian
*  I PAYLOAD sono binari restituiti cosi come sono stati scritti
*/

class TransformationStream extends stream.Transform {
    constructor(onMessage, options) {
        super(options);
        this._buffer = null;

        this._onMessage = onMessage;

        this._currentStep = STEPS.OP_TYPE;
    }


    async read(chunk, cb) {
        this._offsetChunk = 0;
        let stop = false;

        // viene fatto un whilst perchè cosi rendo  la procedura asincrona (ogni pacchetto è sincrono) e do modo all'event loop di fare altro
        async.whilst(
            () => {
                return !stop && this._offsetChunk < chunk.length;
            },
            (wcb) => {
                if (this._currentStep === STEPS.OP_TYPE) {
                    let ok = this.readOpType(chunk);
                    if (!ok) {
                        stop = true;
                        wcb();
                        return;
                    }
                    if (this._opType === STEPS.OP_TYPE) {
                        wcb();
                        return;
                    }
                }
                if (this._currentStep === STEPS.HEADER_LENGTH) {
                    let ok = this.readHeaderLength(chunk);
                    if (!ok) {
                        stop = true;
                        wcb();
                        return;
                    }
                }
                if (this._currentStep === STEPS.HEADER) {
                    let ok = this.readHeader(chunk);
                    if (!ok) {
                        stop = true;
                        wcb();
                        return;
                    }
                }
                if (this._currentStep === STEPS.PAYLOAD_LENGTH) {
                    let ok = this.readPayloadLength(chunk);
                    if (!ok) {
                        stop = true;
                        wcb();
                        return;
                    }
                }
                if (this._currentStep === STEPS.PAYLOAD) {
                    let ok = this.readPayload(chunk);
                    if (!ok) {
                        stop = true;
                        wcb();
                        return;
                    }
                    this._onMessage(this._bufferPayload, this._bufferHeader, this._opType === OP_TYPES.SYSTEM).then(() => {
                        delete this._bufferHeader;
                        delete this._bufferPayload;
                        wcb();
                    });
                }
            },
            () => {
                cb();
            }
        );
    }


    readOpType(chunk) {
        if (chunk.length === 0) return false;
        this._opType = chunk.readUInt8(this._offsetChunk, true);

        if (this._opType === OP_TYPES.KEEP_ALIVE) {
            this._currentStep = STEPS.OP_TYPE;
        } else if (this._opType === OP_TYPES.WITH_HEADER || this._opType === OP_TYPES.SYSTEM) {
            this._currentStep = STEPS.HEADER_LENGTH;
            this._headerLengthBytes = 0;
            this._headerLength = 0;
        } else if (this._opType === OP_TYPES.WITHOUT_HEADER) {
            this._currentStep = STEPS.PAYLOAD_LENGTH;
            this._payloadLengthBytes = 0;
            this._payloadLength = 0;
        }
        this._offsetChunk++;
        return true;
    }

    readHeaderLength(chunk) {
        for (; this._offsetChunk < chunk.length && this._headerLengthBytes < 4;
            this._offsetChunk++ , this._headerLengthBytes++) {
            this._headerLength |= chunk[this._offsetChunk] << (this._headerLengthBytes * 8);
        }
        if (this._headerLengthBytes === 4) {
            this._currentStep = STEPS.HEADER;
            this._bytesHeaderRead = 0;
            this._bufferHeader = Buffer.allocUnsafe(this._headerLength);
            return true;
        } else {
            return false;
        }
    }

    readHeader(chunk) {
        let bytesToRead = this._headerLength - this._bytesHeaderRead;
        let bytesInChunk = chunk.length - this._offsetChunk;
        let end = bytesToRead > bytesInChunk ? chunk.length : this._offsetChunk + bytesToRead;

        let bytesRead = end - this._offsetChunk;
        if (bytesRead <= 0) return false;
        chunk.copy(this._bufferHeader, this._bytesHeaderRead, this._offsetChunk, end);
        this._bytesHeaderRead += bytesRead;
        this._offsetChunk = end;

        if (this._bytesHeaderRead === this._headerLength) {
            this._currentStep = STEPS.PAYLOAD_LENGTH;
            this._payloadLengthBytes = 0;
            this._payloadLength = 0;
            return true;
        } else {
            return false;
        }
    }

    readPayloadLength(chunk) {
        for (; this._offsetChunk < chunk.length && this._payloadLengthBytes < 4;
            this._offsetChunk++ , this._payloadLengthBytes++) {
            this._payloadLength |= chunk[this._offsetChunk] << (this._payloadLengthBytes * 8);
        }
        if (this._payloadLengthBytes === 4) {
            this._currentStep = STEPS.PAYLOAD;
            this._bytesPayloadRead = 0;
            this._bufferPayload = Buffer.allocUnsafe(this._payloadLength);

            return true;
        } else {
            return false;
        }
    }

    readPayload(chunk) {
        let bytesToRead = this._payloadLength - this._bytesPayloadRead;
        let bytesInChunk = chunk.length - this._offsetChunk;
        let end = bytesToRead > bytesInChunk ? chunk.length : this._offsetChunk + bytesToRead;

        let bytesRead = end - this._offsetChunk;
        chunk.copy(this._bufferPayload, this._bytesPayloadRead, this._offsetChunk, end);
        this._bytesPayloadRead += bytesRead;
        this._offsetChunk = end;

        if (this._bytesPayloadRead === this._payloadLength) {
            this._currentStep = STEPS.OP_TYPE;
            return true;
        } else {
            return false;
        }
    }


    _transform(chunk, enc, cb) {
        this.read(chunk, cb);
    }

    _flush(cb) {
        if (this._bufferPayload) {
            delete this._bufferPayload;
        }
        if (this._bufferHeader) {
            delete this._bufferHeader;
        }
        this._currentStep = STEPS.OP_TYPE;
        cb();
    }
}


class Encoder {
    constructor() {
        this.keepAlivePacket = Buffer.alloc(5);
        this.keepAlivePacket.writeUInt8(OP_TYPES.KEEP_ALIVE);
        this.keepAlivePacket.writeUInt32LE(0);


        this.withHeaderOpPacket = Buffer.alloc(1);
        this.withHeaderOpPacket.writeUInt8(OP_TYPES.WITH_HEADER);

        this.withoutHeaderOpPacket = Buffer.alloc(1);
        this.withoutHeaderOpPacket.writeUInt8(OP_TYPES.WITHOUT_HEADER);

        this.systemOpPacket = Buffer.alloc(1);
        this.systemOpPacket.writeUInt8(OP_TYPES.SYSTEM);
    }


    write(socket, payload, header, system) {
        if (header) {
            if (!system) {
                socket.write(this.withHeaderOpPacket);
            } else {
                socket.write(this.systemOpPacket);
            }
            let buf = Buffer.allocUnsafe(4);
            buf.writeUInt32LE(Buffer.byteLength(header), 0, true);
            socket.write(buf);
            buf = null;
            socket.write(header);
        } else {
            socket.write(this.withoutHeaderOpPacket);
        }
        let buf = Buffer.allocUnsafe(4);
        buf.writeUInt32LE(Buffer.byteLength(payload), 0, true);

        socket.write(buf);
        buf = null;
        return socket.write(payload);
    }

    writeKeepAlive(socket) {
        return socket.write(this.keepAlivePacket);
    }
}


module.exports = { TransformationStream, Encoder: new Encoder() };
