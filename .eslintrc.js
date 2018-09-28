(function() {
	var error = 2;

	module.exports = {
		root: true,
		extends: "ftgp",
		parserOptions: {
			ecmaVersion: 6
		},
		rules: {
			"quotes": [error, "double"],
			"ftgp/require-class-comment": 0
		}
	};
})();
