const { ListItem, DoubleLinkedList } = require('./doubleLinkedList');
const Deferred = require('../utils/deferred');

class WatchMap {
    constructor() {
        this.list = new DoubleLinkedList();

        this.map = {};
    }

    wait(watch) {
        let def = new ListItem(new Deferred());
        let ret = def.data.wait();
        this.map[watch] = this.map[watch] || new DoubleLinkedList();
        this.map[watch].push(def);
        return ret;
    }

    wakeUp(watch) {
        let list = this.map[watch];
        if (!list) return;
        if (list.size > 0) {
            if (list.head.data) {
                list.head.data.resolve();
            }

            list.remove(list.head);
            if (list.size === 0) delete this.map[watch];
        }
    }
}

module.exports = WatchMap;
