#!/usr/bin/env node
// /sickday card renderer. Reads one card or an array of cards as JSON (stdin
// or --card <file>), scrubs each, renders a 2400x1260 PNG locally with resvg
// (wasm, shipped with the CLI) and the bundled Geist Mono fonts, and prints
// the full path of each PNG plus a pre-filled X intent link. Fully local: no
// network, no upload, nothing posted. The user attaches the PNG and posts.
// PNG only: if resvg cannot load, it exits non-zero and says why.

import {existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {
	buildPostText,
	buildXIntentUrl,
	CARD_FONT,
	CARD_WIDTH,
	cleanCard,
	fitsX,
	POST_URL,
	renderCardSvg,
} from './card.mjs';

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PNG_SCALE = 2;

/**
 * @typedef {import('./card.mjs').Card} Card
 * @typedef {(svg: string) => Uint8Array} Rasterize
 */

/** @param {string[]} argv @returns {Record<string, string>} */
export function parseArgs(argv) {
	const pairs = argv.flatMap((arg, index) => {
		if (!arg.startsWith('--')) return [];
		const next = argv[index + 1];
		const value = next && !next.startsWith('--') ? next : 'true';
		return [[arg.slice(2), value]];
	});
	return Object.fromEntries(pairs);
}

/**
 * Downloads when it exists (where people attach files from), else tmp.
 * @returns {string}
 */
export function defaultOutDir() {
	const downloads = join(homedir(), 'Downloads');
	if (existsSync(downloads)) return join(downloads, 'sickday');
	return join(tmpdir(), 'sickday');
}

/** @param {Date} date @returns {string} */
export function stamp(date) {
	return date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace('T', '-')
		.slice(0, 15);
}

/** @param {unknown} parsed @returns {Record<string, unknown>[]} */
export function asCardList(parsed) {
	if (Array.isArray(parsed)) return parsed;
	if (parsed && typeof parsed === 'object')
		return [/** @type {Record<string, unknown>} */ (parsed)];
	throw new Error('expected a card object or an array of cards');
}

/** @returns {string} */
function readLogo() {
	return readFileSync(
		join(SKILL_DIR, 'assets', 'commandcode-logo.svg'),
		'utf8',
	);
}

/**
 * Load the vendored resvg-wasm (MPL-2.0, vendor/resvg-wasm) and return a
 * rasteriser. Vendored so the skill runs on bare node with no install.
 * @returns {Promise<Rasterize>}
 */
export async function loadRasterizer() {
	const vendor = join(SKILL_DIR, 'vendor', 'resvg-wasm');
	const resvg = await import(pathToFileURL(join(vendor, 'index.mjs')).href);
	await resvg.initWasm(readFileSync(join(vendor, 'index_bg.wasm')));
	const fontBuffers = ['GeistMono-Regular.ttf', 'GeistMono-Bold.ttf'].map(
		name => new Uint8Array(readFileSync(join(SKILL_DIR, 'fonts', name))),
	);
	// `new Resvg` is the library's only entry point (wasm-bindgen class).
	return svg =>
		new resvg.Resvg(svg, {
			fitTo: {mode: 'width', value: CARD_WIDTH * PNG_SCALE},
			font: {
				fontBuffers,
				loadSystemFonts: false,
				defaultFontFamily: CARD_FONT,
				monospaceFamily: CARD_FONT,
			},
		})
			.render()
			.asPng();
}

/**
 * @param {Record<string, unknown>} input
 * @param {{outDir: string, name: string, logo: string, rasterize: Rasterize}} options
 */
export function renderOne(input, {outDir, name, logo, rasterize}) {
	const {card, redacted} = cleanCard(input);
	const png = join(outDir, `${name}.png`);
	writeFileSync(png, rasterize(renderCardSvg(card, logo)));
	const postText = buildPostText(card.heat);
	return {
		card,
		redacted,
		png,
		postText,
		postFitsX: fitsX(postText),
		intentUrl: buildXIntentUrl({text: postText, url: POST_URL}),
	};
}

/** @param {Record<string, string>} args @returns {string} */
function readInput(args) {
	if (args.card) return readFileSync(args.card, 'utf8');
	return readFileSync(0, 'utf8');
}

/** @param {unknown} error @returns {string} */
function message(error) {
	return error instanceof Error ? error.message : String(error);
}

/** @returns {Promise<void>} */
async function main() {
	const args = parseArgs(process.argv.slice(2));
	const cards = asCardList(JSON.parse(readInput(args)));
	const outDir = resolve(args['out-dir'] ?? defaultOutDir());
	mkdirSync(outDir, {recursive: true});

	const rasterize = await loadRasterizer().catch(error => {
		throw new Error(`could not load the PNG renderer: ${message(error)}`);
	});
	const prefix = `sickday-${stamp(new Date())}`;
	const logo = readLogo();
	const results = cards.map((input, index) =>
		renderOne(input, {
			outDir,
			name: `${prefix}-${index + 1}`,
			logo,
			rasterize,
		}),
	);
	const report = {outDir, cards: results};
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const isEntry =
	process.argv[1] &&
	realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isEntry) {
	main().catch(error => {
		process.stderr.write(`sickday: ${message(error)}\n`);
		process.exit(1);
	});
}
