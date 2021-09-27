const welcome = require('cli-welcome');
const pkg = require('./../package.json');
const unhandled = require('cli-handle-unhandled');

module.exports = ({ clear = true }) => {
	unhandled();
	welcome({
		title: `greenlight-bench`,
		tagLine: `by Patrizio Bekerle`,
		description: pkg.description,
		version: pkg.version,
		bgColor: '#e4154b',
		color: '#000000',
		bold: true,
		clear
	});
};
