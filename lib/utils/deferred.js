class DeferredPromise {
    constructor() {
        this.p = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }


    wait() {
        return this.p;
    }
}

module.exports = DeferredPromise;
