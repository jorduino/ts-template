/**
 * @type {import('@commitlint/types').UserConfig}
 */
const config = {
	extends: ["@commitlint/config-conventional"],
	ignores: [(message) => message.startsWith("Initial commit")],
	rules: {
		"subject-case": [0, "always", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
	},
};

export default config;
