

const { machineIdSync } = require('node-machine-id');

module.exports = () => {
    return machineIdSync();
};
