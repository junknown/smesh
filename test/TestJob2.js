const fs = require('fs');

class TestJob {
    constructor(jobConfig, clusterClient) {
        this.config = jobConfig;
        this.client = clusterClient;
    }

    async initialize(register) {
        console.log('Inizializzato!!!');

        this.start = 0;

        register('test2.testChannel1', this.onEvent1.bind(this));
        register('test2.testChannel2', this.onEvent2.bind(this));
        register('global.manutenzione', this.onManutenzione.bind(this));
    }

    async onEvent1({ test }) {
        return 'CIAO ' + test + ' 1';
    }

    async onEvent2({ test }) {
        return 'CIAO ' + test + ' 2';
    }

    async onManutenzione() {
        return true;
    }
}

module.exports = TestJob;
