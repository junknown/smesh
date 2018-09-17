class ListItem {
    constructor(data) {
        this.next = null;
        this.prev = null;
        this.data = data;
    }
}

class DoubleLinkedList {
    constructor() {
        this.head = null;
        this.tail = null;
        this.size = 0;
    }

    prepend(item) {
        if (this.size > 0) {
            let oldHead = this.head;
            oldHead.prev = item;
            item.next = oldHead;
            this.head = item;
        } else {
            this.tail = item;
            this.head = item;
        }

        this.size++;
    }

    push(item) {
        if (this.size > 0) {
            this.tail.next = item;
            item.prev = this.tail;
            this.tail = item;
        } else {
            this.tail = item;
            this.head = item;
        }
        this.size++;
    }

    remove(item) {
        let prev = item.prev;
        let next = item.next;
        if (!prev && !next) {
            this.head = null;
            this.tail = null;
        } else if (!prev && next) {
            this.head = next;
            next.prev = null;
        } else if (prev && !next) {
            this.tail = prev;
            prev.next = null;
        } else {
            prev.next = next;
            next.prev = prev;
        }
        this.size--;
    }


    clear() {
        this.head = null;
        this.tail = null;
        this.size = 0;
    }
}

module.exports = { ListItem, DoubleLinkedList };
