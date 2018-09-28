const path = require("path");
const webpack = require("webpack");
const aliases = require("./webpack.aliases.js");

let config = {
	mode: "development",
	devtool: "cheap-eval-source-map",
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "external.latest.js"
	},
	entry: "./js/external_main.js",
	resolve: {
		modules: [path.resolve(__dirname, "js"), "node_modules"],
		alias: aliases
	},
	plugins: [
		new webpack.ProvidePlugin({
			"$": "jquery",
			jQuery: "jquery",
			"window.jQuery": "jquery"
		}),
		new webpack.optimize.LimitChunkCountPlugin({
			maxChunks: 1
		})
	]
};

module.exports = config;
