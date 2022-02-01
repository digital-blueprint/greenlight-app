const meow = require('meow');
const meowHelp = require('cli-meow-help');

const flags = {
	token: {
		type: `string`,
		alias: `t`,
		isRequired: true,
		desc: `Bearer token (mandatory)`
	},
	clear: {
		type: `boolean`,
		default: true,
		alias: `c`,
		desc: `Clear the console`
	},
	noClear: {
		type: `boolean`,
		default: false,
		desc: `Don't clear the console`
	},
	debug: {
		type: `boolean`,
		default: false,
		alias: `d`,
		desc: `Print debug info`
	},
	version: {
		type: `boolean`,
		alias: `v`,
		desc: `Print CLI version`
	},
	apiUrl: {
		type: `string`,
		alias: `u`,
		default: 'https://api-dev.tugraz.at',
		desc: `API url`
	},
	requests: {
		type: `number`,
		alias: `r`,
		default: 1,
		isRequired: true,
		desc: `Number of requests to perform for the benchmarking session`
	},
	concurrency: {
		type: `number`,
		alias: `c`,
		default: 1,
		isRequired: true,
		desc: `Number of multiple requests to perform at a time`
	},
	verbose: {
		type: `boolean`,
		alias: `v`,
		default: false,
		desc: `Tell Apache Bench to show more information`
	},
	help: {
		type: `boolean`,
		alias: `h`,
		default: false,
		desc: `Show help text`
	}
};

const commands = {
	'permit-post': { desc: `Create a permit` },
	'permit-get': { desc: `Read a permit` }
};

const helpText = meowHelp({
	name: `greenlight-bench`,
	flags,
	commands
});

const options = {
	inferType: true,
	description: false,
	hardRejection: false,
	flags
};

module.exports = meow(helpText, options);
