const IndexedList = require('../lib/structures/indexedList');
const GlobalLogger = require('global-logger');
let chai = require('chai');
let muteFnc = require('mute');

const TO_MUTE = false;
process.env.LOG_LEVEL = 'INFO';
global.logger = GlobalLogger({ LOG_LEVEL: process.env.LOG_LEVEL || 'INFO', SUFFIX: 'Main' });
const mute = () => {
    if (TO_MUTE) { return muteFnc(); } else return () => { };
};
/* global describe,before,after,it */
/* eslint no-multi-str:0 no-unused-expressions:0 */

describe('Linked List', () => {
    before(async () => {

    });
    after(async () => {

    });

    describe('Populate', () => {
        it('Test di popolamento della lista', async () => {
            let unmute = mute();

            let list = new IndexedList();
            list.indexAndPush('1', { nome: '1' }, ['a', 'b']);
            let head = list.head;
            let tail = list.tail;

            unmute();

            chai.expect(head).eq(tail);
            chai.expect(head.data.nome).eq('1');

            chai.expect(list.getById('1')).eq(head);
        });
    });

    describe('Populate', () => {
        it('Test di popolamento della lista', async () => {
            let unmute = mute();

            let list = new IndexedList();
            list.indexAndPush('1', { nome: '1' }, ['a', 'b']);
            list.indexAndPush('2', { nome: '2' }, ['b', 'c']);
            let head = list.head;
            let tail = list.tail;


            unmute();

            chai.expect(head.data.nome).eq('1');
            chai.expect(tail.data.nome).eq('2');
        });
    });

    describe('Get by index', () => {
        it('Test di retrieve da indice', async () => {
            let unmute = mute();

            let list = new IndexedList();
            list.indexAndPush('1', { nome: '1' }, ['a', 'b']);
            list.indexAndPush('2', { nome: '1' }, ['a', 'b']);
            list.indexAndPush('3', { nome: '1' }, ['a', 'b']);
            list.indexAndPush('4', { nome: '1' }, ['a', 'b']);
            list.indexAndPush('5', { nome: '2' }, ['b', 'x']);
            list.indexAndPush('6', { nome: '1' }, ['a', 'b']);
            list.indexAndPush('7', { nome: '1' }, ['a', 'b']);
            chai.expect(list.indices.x.size).eq(1);
            let i = list.getFirstDataByIndices(['x']);
            unmute();
            chai.expect(i.data.nome).eq('2');
        });
    });

    describe('Get by index', () => {
        it('Test di retrieve/repush/delete da indice', async () => {
            let unmute = mute();

            let list = new IndexedList();
            list.indexAndPush('1', { nome: '1' }, ['a', 'b']);
            list.indexAndPush('2', { nome: '2' }, ['a', 'b']);
            list.indexAndPush('3', { nome: '3' }, ['a', 'y']);
            list.indexAndPush('4', { nome: '4' }, ['a', 'y']);
            list.indexAndPush('5', { nome: '5' }, ['b', 'x']);
            list.indexAndPush('6', { nome: '6' }, ['a', 'b']);
            list.indexAndPush('7', { nome: '7' }, ['a', 'x']);
            unmute();


            let a = list.getFirstDataByIndices(['y']);
            chai.expect(a.id).eq('3');

            let cc = list.getFirstDataByIndices(['x', 'b']);
            chai.expect(cc.id).eq('1');

            list.remove(a);
            chai.expect(list.size).eq(6);
            chai.expect(list.indices.y.size).eq(1);
            let b = list.getFirstDataByIndices(['y']);
            chai.expect(b.id).eq('4');
            list.push(a);
            let c = list.getFirstByIndices(['y']);
            chai.expect(c.data.id).eq('4');
            chai.expect(c.next.data.id).eq('3');


            let d = list.getFirstByIndices(['y']);
            list.remove(d.data);
            let d1 = list.getFirstByIndices(['y']);
            list.remove(d1.data);
            chai.expect(d1.data).eq(c.next.data);

            chai.expect(list.getById('3')).to.be.undefined;
            chai.expect(list.getById('4')).to.be.undefined;
            chai.expect(list.indices.y).to.be.undefined;
            chai.expect(list.size).eq(5);

            chai.expect(list.indices.x.size).eq(2);
            list.removeById(7);
            chai.expect(list.size).eq(4);
            chai.expect(list.indices.x.size).eq(1);
        });
    });
    describe('Get by index', () => {
        it('Test di retrieve da indici con compare', async () => {
            let unmute = mute();

            let list = new IndexedList();
            list.indexAndPush('1', { nome: '1' }, ['a', 'b']);
            list.indexAndPush('2', { nome: '2' }, ['a', 'b']);
            list.indexAndPush('3', { nome: '3', value: 21 }, ['a', 'y']);
            list.indexAndPush('4', { nome: '4', value: 11 }, ['a', 'y']);
            list.indexAndPush('5', { nome: '5', value: 10 }, ['b', 'x']);
            list.indexAndPush('6', { nome: '6' }, ['a', 'b']);
            list.indexAndPush('7', { nome: '7' }, ['a', 'x']);
            unmute();

            let d = list.getFirstDataByIndices(['y', 'x']);
            chai.expect(d.id).eq('3');
            let d2 = list.getFirstDataByIndices(['y', 'x'], (a, b) => {
                if (a.data.data.value < b.data.data.value) return a;
                else return b;
            });
            chai.expect(d2.id).eq('5');
        });
    });

    describe.only('Enable item in index', () => {
        it('Test di enable/disable item', async () => {
            let unmute = mute();

            let list = new IndexedList();
            list.indexAndPush('1', { nome: '1' }, ['a', 'b']);
            list.indexAndPush('2', { nome: '2' }, ['a', 'b']);
            unmute();

            list.disable('1');
            let d = list.getFirstDataByIndices(['a']);
            chai.expect(d.id).eq('2');
            list.enable('1');
            let d2 = list.getFirstDataByIndices(['a']);
            chai.expect(d2.id).eq('2');
        });
    });
});
