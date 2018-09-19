const Path = require('path');
const fs = require('fs');


module.exports = (program) => {
    let configOption = {};
    if (program.configPath) {
        let config = fs.readFileSync(Path.resolve(process.cwd(), program.configPath), 'utf8');

        configOption = JSON.parse(config);
        if (configOption.machineId) {
            process.env.MACHINE_ID = configOption.machineId;
        }
        if (configOption.logLevel) {
            process.env.LOG_LEVEL = configOption.logLevel;
        }
    }

    if (program.machine) {
        process.env.MACHINE_ID = program.machine;
    }

    if (!process.env.MACHINE_ID) {
        process.env.MACHINE_ID = require('../lib/utils/machineId')();
    }
    if (!process.env.LOG_LEVEL) {
        process.env.LOG_LEVEL = 'INFO';
    }
    return configOption;
};
