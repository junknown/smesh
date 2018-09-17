const { ListItem, DoubleLinkedList } = require('./doubleLinkedList');
const Deferred = require('../utils/deferred');

class WaitingQueue {
    constructor() {
        this.list = new DoubleLinkedList();
    }

    wait() {
        let def;
        let ret;
        if (this.list.size > 0) {
            def = new ListItem(new Deferred());
            this.list.push(def);
            ret = def.data.wait();
        } else {
            def = {};
            this.list.push(def);
        }
        this.list.remove(def);
        return ret;
    }

    next() {
        if (this.list.size > 0) {
            this.list.head.data.resolve();
        }
    }
}

module.exports = WaitingQueue;
