

const { DoubleLinkedList, ListItem } = require('./doubleLinkedList');

class IndexedList extends DoubleLinkedList {
    constructor() {
        super();
        this.dataMap = {};
        this.indices = {};
        this.indicesList = [];
    }

    indexAndPush(id, item, indices = [], noDataMap = false) {
        if (!noDataMap && this.dataMap[id]) return false;
        let dataListItem = new ListItem(item);
        dataListItem.id = id;
        dataListItem.indices = [];
        dataListItem.time = new Date().getTime();
        for (let i = 0; i < indices.length; i++) {
            let indexName = indices[i];
            let index = this.indices[indexName];
            if (!index) {
                index = new DoubleLinkedList();
                this.indices[indexName] = index;
            }
            let indexListItem = new ListItem(dataListItem);
            dataListItem.indices.push({ indexName, listItem: indexListItem });
            index.push(indexListItem);
        }
        super.push(dataListItem);
        // evito una sovrapposizione di date
        if (dataListItem.prev && dataListItem.prev.time >= dataListItem.time) {
            dataListItem.time = dataListItem.prev.time + 1;
        }
        this.dataMap[id] = dataListItem;
        return true;
    }

    push(listItem, noDataMap = false) {
        return this.indexAndPush(listItem.id, listItem.data, listItem.indices.map(x => x.indexName), noDataMap);
    }


    disable(id) {
        if (!this.dataMap[id]) return;
        this.removeById(id, true);
    }

    enable(id) {
        if (!this.dataMap[id]) return;
        let it = this.dataMap[id];
        this.push(it, true);
    }

    removeById(id, noMap) {
        let dataListItem = this.dataMap[id];
        if (!dataListItem) return null;
        this.remove(dataListItem, noMap);
    }

    remove(dataListItem, noMap = false) {
        if (dataListItem.indices) {
            for (let i = 0; i < dataListItem.indices.length; i++) {
                let indexRef = dataListItem.indices[i];
                let index = this.indices[indexRef.indexName];
                if (index) {
                    index.remove(indexRef.listItem);
                    if (index.size === 0) {
                        delete this.indices[indexRef.indexName];
                    }
                }
            }
        }
        super.remove(dataListItem);
        if (!noMap) {
            delete this.dataMap[dataListItem.id];
        }
    }

    compareItem(item1, item2) {
        if (item1.data.time > item2.data.time) return item2;
        else return item1;
    }

    getFirstByIndices(indices, compare = this.compareItem) {
        let bestNode;
        for (let i = 0; i < indices.length; i++) {
            let indexName = indices[i];
            if (!this.indices[indexName]) {
                continue;
            }
            let node = this.indices[indexName].head;
            if (!node) continue;
            if (!bestNode) {
                bestNode = node;
            } else {
                bestNode = compare(bestNode, node);
            }
        }
        return bestNode;
    }

    getFirstDataByIndices(indices, compare) {
        let node = this.getFirstByIndices(indices, compare);
        if (!node) return null;
        return node.data;
    }


    getById(id) {
        return this.dataMap[id];
    }
}


module.exports = IndexedList;
