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
const fs = require('fs');
const { execFile } = require('child_process');
const tmp = require('tmp');

const input = cli.input;
const flags = cli.flags;
const { clear, debug, token, requests, concurrency, verbose } = flags;
let { apiUrl } = flags;

(async () => {
	init({ clear });
	input.includes(`help`) && cli.showHelp(0);

	// if (token === '') {
	//     console.error('You need to add a token with the --token parameter.');
	//     process.exit(1);
	// }

	let url = '';
	let parameters = [
		'-n',
		requests,
		'-c',
		concurrency,
		'-H',
		'Authorization: Bearer ' + token,
		'-H',
		'accept: application/ld+json',
		'-T',
		'application/json'
	];

	if (verbose) {
		parameters = parameters.concat(['-v', '4']);
	}

	// remove trailing slash
	apiUrl = apiUrl.replace(/\/$/, '');

	if (input.includes(`permit-post`)) {
		const additionalInformation = await crypto.encodeAdditionalInformation(
			token,
			'local-proof'
		);
		const data =
			'{"consentAssurance": true, "additionalInformation": "' +
			additionalInformation +
			'"}';
		const dataFile = tmp.fileSync();
		let buffer = new Buffer.from(data);

		fs.write(dataFile.fd, buffer, 0, buffer.length, null, function (err) {
			if (err) {
				console.error('Cant write to data file!');
				process.exit(1);
			}
		});

		url = apiUrl + '/greenlight/permits';
		parameters = parameters.concat(['-p', dataFile.name]);
	} else if (input.includes(`permit-get`)) {
		url = apiUrl + '/greenlight/permits';
	}

	if (url === '') {
		console.error(
			'You need to choose a valid test [permit-post, permit-get].'
		);
		process.exit(1);
	}

	parameters = parameters.concat([url]);

	execFile('ab', parameters, (error, stdout, stderr) => {
		if (error) {
			throw error;
		}
		console.log(stdout);
	});

	debug && log(flags);
})();
