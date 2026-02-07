import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	multiselect,
	note,
	outro,
	select,
	spinner,
	text,
} from "@clack/prompts";
import { $ } from "bun";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";

// ── Constants ───────────────────────────────────────────────────────────

const PROJECT_DIR = process.cwd();
const PKG_PATH = join(PROJECT_DIR, "package.json");

interface FeatureConfig {
	label: string;
	hint?: string;
	files: string[];
	devDeps: string[];
	scripts?: string[];
}

const FEATURES: Record<string, FeatureConfig> = {
	gitHooks: {
		label: "Git hooks (Husky + commitlint + lint-staged)",
		hint: "pre-commit testing, commit message linting",
		files: [".husky", "commitlint.config.js", ".lintstagedrc"],
		devDeps: ["@commitlint/cli", "@commitlint/config-conventional", "husky", "lint-staged"],
		scripts: ["prepare"],
	},
	githubTemplates: {
		label: "GitHub issue & PR templates",
		hint: "bug report, feature request, PR template",
		files: [".github/ISSUE_TEMPLATE", ".github/PULL_REQUEST_TEMPLATE.md"],
		devDeps: [],
	},
	githubCI: {
		label: "GitHub Actions CI workflow",
		hint: "automated testing on push/PR",
		files: [".github/workflows"],
		devDeps: [],
	},
	markdownlint: {
		label: "Markdownlint",
		hint: "markdown file linting",
		files: [".markdownlint.json", ".markdownlintignore"],
		devDeps: ["markdownlint-cli"],
	},
	codeOfConduct: {
		label: "Code of Conduct",
		hint: "Contributor Covenant",
		files: ["CODE_OF_CONDUCT.md"],
		devDeps: [],
	},
	claudeCode: {
		label: "Claude Code configuration",
		hint: "CLAUDE.md with Bun API guidelines",
		files: ["CLAUDE.md"],
		devDeps: [],
	},
};

// ── Helpers ─────────────────────────────────────────────────────────────

function assertNotCancelled<T>(value: T | symbol): asserts value is T {
	if (isCancel(value)) {
		cancel("Setup cancelled. Re-run with: bun setup/setup.ts");
		process.exit(0);
	}
}

async function readPkg(): Promise<Record<string, unknown>> {
	return JSON.parse(await Bun.file(PKG_PATH).text());
}

async function writePkg(pkg: Record<string, unknown>): Promise<void> {
	await Bun.write(PKG_PATH, `${JSON.stringify(pkg, null, "\t")}\n`);
}

async function removeFiles(paths: string[]): Promise<void> {
	for (const p of paths) {
		const full = join(PROJECT_DIR, p);
		if (existsSync(full)) {
			await $`rm -rf ${full}`.quiet();
		}
	}
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
	const projectName = basename(PROJECT_DIR);

	intro(`Setting up ${projectName}`);

	// ── Package metadata ────────────────────────────────────────────

	const description = await text({
		message: "Project description",
		placeholder: "A brief description of your project",
		defaultValue: "",
	});
	assertNotCancelled(description);

	const version = await text({
		message: "Initial version",
		placeholder: "0.1.0",
		defaultValue: "0.1.0",
		validate: (v) => {
			if (!/^\d+\.\d+\.\d+/.test(v)) return "Must be valid semver (e.g. 0.1.0)";
		},
	});
	assertNotCancelled(version);

	const author = await text({
		message: "Author",
		placeholder: "Your Name <email@example.com>",
		defaultValue: "",
	});
	assertNotCancelled(author);

	const license = await select({
		message: "License",
		options: [
			{ value: "MIT", label: "MIT", hint: "permissive" },
			{ value: "Apache-2.0", label: "Apache 2.0", hint: "permissive with patent grant" },
			{ value: "ISC", label: "ISC", hint: "simplified MIT" },
			{ value: "GPL-3.0-only", label: "GPL 3.0", hint: "copyleft" },
			{ value: "UNLICENSED", label: "Unlicensed", hint: "proprietary" },
		],
		initialValue: "MIT",
	});
	assertNotCancelled(license);

	const isPrivate = await confirm({
		message: "Private package? (prevents accidental npm publish)",
		initialValue: true,
	});
	assertNotCancelled(isPrivate);

	const entrypoint = await text({
		message: "Entrypoint",
		placeholder: "src/index.ts",
		defaultValue: "src/index.ts",
	});
	assertNotCancelled(entrypoint);

	// ── Feature selection ───────────────────────────────────────────

	const selectedFeatures = await multiselect({
		message: "Which features would you like to keep?",
		options: Object.entries(FEATURES).map(([value, config]) => ({
			value,
			label: config.label,
			hint: config.hint,
		})),
		initialValues: ["gitHooks", "githubTemplates", "githubCI", "markdownlint", "codeOfConduct"],
		required: false,
	});
	assertNotCancelled(selectedFeatures);

	// ── Apply changes ───────────────────────────────────────────────

	const s = spinner();
	s.start("Configuring project...");

	const pkg = await readPkg();

	// Update metadata
	pkg.description = description;
	pkg.version = version;
	pkg.author = author;
	pkg.license = license;
	pkg.private = isPrivate;
	pkg.main = entrypoint;
	pkg.keywords = [];

	// Update start script if entrypoint changed
	if (entrypoint !== "src/index.ts" && pkg.scripts) {
		(pkg.scripts as Record<string, string>).start = `bun ${entrypoint}`;
	}

	// Determine deselected features
	const deselected = Object.keys(FEATURES).filter((k) => !selectedFeatures.includes(k));
	const depsToRemove: string[] = [];
	const filesToRemove: string[] = [];
	const scriptsToRemove: string[] = [];

	for (const key of deselected) {
		const feature = FEATURES[key];
		filesToRemove.push(...feature.files);
		depsToRemove.push(...feature.devDeps);
		if (feature.scripts) scriptsToRemove.push(...feature.scripts);
	}

	// Remove devDependencies
	if (depsToRemove.length > 0 && pkg.devDependencies) {
		const devDeps = pkg.devDependencies as Record<string, string>;
		for (const dep of depsToRemove) {
			delete devDeps[dep];
		}
	}

	// Remove scripts
	if (scriptsToRemove.length > 0 && pkg.scripts) {
		const scripts = pkg.scripts as Record<string, string>;
		for (const script of scriptsToRemove) {
			delete scripts[script];
		}
	}

	// ── Cross-feature cleanup ───────────────────────────────────────

	// If markdownlint removed but git hooks kept, clean .lintstagedrc
	if (!selectedFeatures.includes("markdownlint") && selectedFeatures.includes("gitHooks")) {
		const lintStagedPath = join(PROJECT_DIR, ".lintstagedrc");
		if (existsSync(lintStagedPath)) {
			const lintStaged = JSON.parse(await Bun.file(lintStagedPath).text());
			delete lintStaged["*.md"];
			await Bun.write(lintStagedPath, `${JSON.stringify(lintStaged, null, "\t")}\n`);
		}
	}

	// If markdownlint removed, clean .vscode/settings.json
	if (!selectedFeatures.includes("markdownlint")) {
		const vscodePath = join(PROJECT_DIR, ".vscode/settings.json");
		if (existsSync(vscodePath)) {
			const settings = JSON.parse(await Bun.file(vscodePath).text());
			delete settings["[markdown]"];
			await Bun.write(vscodePath, `${JSON.stringify(settings, null, "\t")}\n`);
		}
	}

	// If git hooks removed but CI kept, strip commitlint steps from ci.yml
	if (!selectedFeatures.includes("gitHooks") && selectedFeatures.includes("githubCI")) {
		const ciPath = join(PROJECT_DIR, ".github/workflows/ci.yml");
		if (existsSync(ciPath)) {
			let ci = await Bun.file(ciPath).text();
			// Remove the two commitlint steps
			ci = ci.replace(
				/\n\s*- name: Validate current commit.*?run: bunx commitlint --last --verbose\n/s,
				"\n",
			);
			ci = ci.replace(
				/\n\s*- name: Validate PR commits.*?--verbose\n/s,
				"\n",
			);
			await Bun.write(ciPath, ci);
		}
	}

	// If github CI removed, also clean .vscode/settings.json github-actions entry
	if (!selectedFeatures.includes("githubCI")) {
		const vscodePath = join(PROJECT_DIR, ".vscode/settings.json");
		if (existsSync(vscodePath)) {
			const settings = JSON.parse(await Bun.file(vscodePath).text());
			delete settings["[github-actions-workflow]"];
			await Bun.write(vscodePath, `${JSON.stringify(settings, null, "\t")}\n`);
		}
	}

	// If both github templates and CI removed, remove entire .github/
	if (!selectedFeatures.includes("githubTemplates") && !selectedFeatures.includes("githubCI")) {
		filesToRemove.push(".github");
	}

	// Remove files for deselected features
	await removeFiles(filesToRemove);

	// Remove setup script and @clack/prompts from final project
	const devDeps = pkg.devDependencies as Record<string, string> | undefined;
	if (devDeps) {
		delete devDeps["@clack/prompts"];
	}

	// Remove bun-create section (should already be gone via bun create, but just in case)
	delete pkg["bun-create"];

	await writePkg(pkg);
	await removeFiles(["setup"]);

	// Re-install to clean lockfile
	if (depsToRemove.length > 0) {
		s.message("Cleaning up dependencies...");
		await $`bun install`.quiet();
	}

	// Generate fresh README
	s.message("Generating README...");
	await generateReadme(projectName, description, selectedFeatures);

	s.stop("Project configured!");

	// Handle license file
	if (license !== "Apache-2.0") {
		if (license === "UNLICENSED") {
			await removeFiles(["LICENSE"]);
		} else {
			log.info(`License set to ${license}. Remember to replace the LICENSE file contents.`);
		}
	}

	// Summary
	const kept = selectedFeatures.map((k: string) => `  + ${FEATURES[k].label}`);
	const removed = deselected.map((k) => `  - ${FEATURES[k].label}`);
	note([...kept, ...removed].join("\n"), "Features");

	outro("Done! Run `bun start` to begin.");
}

async function generateReadme(
	name: string,
	description: string,
	features: string[],
): Promise<void> {
	const lines = [
		`# ${name}`,
		"",
		description || "A TypeScript project powered by Bun.",
		"",
		"## Stack",
		"",
		"- **Runtime:** [Bun](https://bun.sh)",
		"- **Language:** TypeScript (strict mode)",
		"- **Linting/Formatting:** [Biome](https://biomejs.dev)",
	];

	if (features.includes("gitHooks")) {
		lines.push("- **Git Hooks:** Husky + lint-staged + commitlint");
	}
	if (features.includes("markdownlint")) {
		lines.push("- **Markdown Linting:** markdownlint");
	}

	lines.push(
		"",
		"## Getting Started",
		"",
		"```bash",
		"bun install",
		"bun start",
		"```",
		"",
		"## Scripts",
		"",
		"| Command | Description |",
		"| --- | --- |",
		"| `bun start` | Run the project |",
		"| `bun test` | Run tests |",
		"| `bun run lint` | Check for lint/format issues |",
		"| `bun run format` | Fix lint/format issues |",
	);

	if (features.includes("gitHooks")) {
		lines.push(
			"",
			"## Commit Convention",
			"",
			"This project uses [Conventional Commits](https://www.conventionalcommits.org/).",
			"",
			"```text",
			"feat: add new feature",
			"fix: resolve bug",
			"docs: update documentation",
			"chore: maintenance tasks",
			"```",
		);
	}

	lines.push("");

	await Bun.write(join(PROJECT_DIR, "README.md"), lines.join("\n"));
}

main().catch((err) => {
	console.error("Setup failed:", err);
	process.exit(1);
});
