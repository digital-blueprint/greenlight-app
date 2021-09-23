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
const axios = require('axios');
const crypto = require('./crypto.js');


const input = cli.input;
const flags = cli.flags;
const { clear, debug, apiUrl, token } = flags;

(async () => {
	init({ clear });
	input.includes(`help`) && cli.showHelp(0);

	// console.log("input", input);
	// console.log("flags", flags);

	if (input.includes('start')) {
		console.log("start");
		const additionalInformation = await crypto.encodeAdditionalInformation(token, "local-proof");
		// console.log("additionalInformation", additionalInformation);
		const data = '{"consentAssurance": true, "additionalInformation": "' + additionalInformation + '"}';

		axios.post(apiUrl + '/greenlight/permits', data, {
			headers: {
				'Authorization': 'Bearer ' + token,
				'accept': 'application/ld+json',
				'Content-Type': 'application/json'
			}
		})
			.then(res => {
				console.log(res.data);
			})
			.catch(function (error) {
				console.error(error.response.data);
			});
	}

	debug && log(flags);
})();
