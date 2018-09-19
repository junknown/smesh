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
        return ret;
    }

    next() {
        if (this.list.size > 0) {
            if (this.list.head.data) {
                this.list.head.data.resolve();
            }

            this.list.remove(this.list.head);
        }
    }
}

module.exports = WaitingQueue;
