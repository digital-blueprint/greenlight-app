#!/usr/bin/env node

/**
 * greenlight-bench
 * Benchmarking for DBP Greenlight
 *
 * @author Patrizio Bekerle <patrizio.bekerle@tugraz.at>
 */

const init = require('./utils/init');
const cli = require('./utils/cli');
const log = require('./utils/log');
const crypto = require('./crypto.js');
const process = require('process');
const fs = require("fs");
const { execFile } = require('child_process');
const tmp = require('tmp');

const input = cli.input;
const flags = cli.flags;
const { clear, debug, apiUrl, token, requests, concurrency } = flags;

(async () => {
	init({ clear });
	input.includes(`help`) && cli.showHelp(0);

    // if (token === '') {
    //     console.error('You need to add a token with the --token parameter.');
    //     process.exit(1);
    // }

    const additionalInformation = await crypto.encodeAdditionalInformation(token, "local-proof");
    const data = '{"consentAssurance": true, "additionalInformation": "' + additionalInformation + '"}';
    const dataFile = tmp.fileSync();
    let buffer = new Buffer.from(data);

    fs.write(dataFile.fd, buffer, 0, buffer.length, null, function(err) {
        if (err) {
            console.error('Cant write to data file!');
            process.exit(1);
        }
    });

    const url = apiUrl + '/greenlight/permits';
    const parameters = [
        '-n', requests,
        '-c', concurrency,
        '-p', dataFile.name,
        '-H', 'Authorization: Bearer ' + token,
        '-H', 'accept: application/ld+json',
        '-T', 'application/json',
        // '-v', '4',
        url];

    execFile('ab', parameters, (error, stdout, stderr) => {
        if (error) {
            throw error;
        }
        console.log(stdout);
    });

	debug && log(flags);
})();
