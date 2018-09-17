class AsyncEmitter {
    constructor() {
        this.handlers = {};
    }

    emit(event, msg) {
        if (this.handlers[event]) {
            let list = this.handlers[event];
            for (let i = 0; i < list.length; i++) {
                list[i](msg);
            }
        }
    }

    async emitAsync(event, msg, parallel = true) {
        let promises = [];
        if (this.handlers[event]) {
            let list = this.handlers[event];
            for (let i = 0; i < list.length; i++) {
                let fnc = list[i];
                let p = fnc(msg);
                if (parallel) {
                    promises.push(p);
                } else {
                    await p;
                }
            }
        }
        if (parallel && promises.length > 0) {
            await Promise.all(promises);
        }
    }

    on(event, fnc, exclusive = false) {
        if (exclusive || !this.handlers[event]) this.handlers[event] = [];
        this.handlers[event].push(fnc);
    }


    off(event, fnc) {
        if (!fnc) delete this.handlers[event];
        else {
            let idx = this.handlers[event].indexOf(fnc);
            this.handlers[event].splice(idx, 1);
            if (this.handlers[event].length === 0) delete this.handlers[event];
        }
    }
}
module.exports = AsyncEmitter;
