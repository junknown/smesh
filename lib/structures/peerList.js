
const IndexedList = require('./indexedList');

class PeerList {
    constructor() {
        this.list = new IndexedList();
        this.channels = [];
    }

    _calculateIndex(peer) {
        return peer.channels.map((channel) => {
            return channel;
        });
    }

    insertPeer(peer) {
        peer.status = -1;
        return this.list.indexAndPush(peer.id, peer, []);
    }

    indexPeer(id, status, channels) {
        let peerListItem = this.list.getById(id);

        if (!peerListItem) return false;
        if (peerListItem.data.status >= status) return false;
        // se lo stato è cambiato rimuovo e reindicizzo il peer
        this.list.removeById(id);
        let peer = peerListItem.data;
        peerListItem = null;
        peer.channels = channels;
        peer.status = status;
        let indexes = [];
        for (let channel of channels) {
            indexes.push(channel);
        }
        this.list.indexAndPush(id, peer, indexes);
        this.channels = Object.keys(this.list.indices);
        global.logger.debug('Lista di job supportati aggiornata:', this.channels);
        return true;
    }

    async foreachPeer(fnc) {
        let item = this.list.head;
        while (item) {
            await fnc(item.data);
            item = item.next;
        }
    }

    getChannels() {
        return this.channels;
    }

    getPeer(peerId) {
        let item = this.list.getById(peerId);
        if (!item) return undefined;
        return item.data;
    }

    removePeer(peer) {
        this.list.removeById(peer.id);
        this.channels = Object.keys(this.list.indices);
    }

    usePeer(peerId) {
        let item = this.list.getById(peerId);
        this.list.remove(item);
        this.list.push(item);
    }


    getChannelPeers(channel) {
        let indices = [channel];
        let item = this.list.getFirstByIndices(indices);
        let peers = [];
        while (item) {
            peers.push(item.data.data);
            item = item.next;
        }
        return peers;
    }


    getBestPeer(channel) {
        let indices = [channel];

        let peer = this.list.getFirstDataByIndices(indices);
        if (!peer) return null;
        return peer.data;
    }

    setReady(peerId) {
        this.list.enable(peerId);
    }

    unsetReady(peerId) {
        this.list.disable(peerId);
    }
}


module.exports = PeerList;
