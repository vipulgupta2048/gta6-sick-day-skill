// /sickday card: pure data in, SVG string out. No I/O here, so every piece is
// unit-testable; sickday.mjs reads the input, rasterises and writes files.
//
// The look follows the Command Code usage stats share card: black canvas,
// hairline borders, corner handles, mono uppercase labels with `>_`, purple /
// emerald / amber accents. Every glyph is Geist Mono, so wrapping is exact
// arithmetic (advance = 0.6em). Original art only: no third-party marks.
//
// Plain ESM with JSDoc types: bundled skill files ship raw and run on bare node.

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
export const CARD_FONT = 'Geist Mono';

export const LIMITS = Object.freeze({
	name: 24,
	subject: 72,
	body: 520,
	shippingItem: 52,
	shippingItems: 3,
});

export const HEAT_LABELS = Object.freeze({
	1: 'Calendar invite',
	2: 'Polite heads-up',
	3: 'Vague but sincere',
	4: 'Suspicious timing',
	5: 'Already logged off',
});

const MONO_ADVANCE = 0.6;
const LEFT_WIDTH = 720;
const PAD = 48;
const FOOTER_HEIGHT = 56;
const ROW_HEIGHT = (CARD_HEIGHT - FOOTER_HEIGHT) / 3;
const LOGO_HEIGHT = 190;

const BLACK = '#000000';
const TEXT = '#fafafa';
const MUTED = '#a1a1aa';
const FAINT = 'rgba(161,161,170,0.62)';
const BORDER = 'rgba(255,255,255,0.1)';
const BORDER_STRONG = 'rgba(255,255,255,0.16)';
const PURPLE = '#a855f7';
const EMERALD = '#10b981';
const AMBER = '#f59e0b';
const AMBER_SOFT = 'rgba(245,158,11,0.16)';

const HOOKS = Object.freeze({
	1: 'GTA 6 is out Thursday. I took the day off. My coding agent did not.',
	2: 'Wrote my GTA 6 day-off note. My agent covers the PRs while I am away.',
	3: 'Calling in for GTA 6 launch day. The excuse cites my real PRs.',
	4: 'I am out sick for GTA 6. My agent is not. My manager gets this at 9am.',
	5: 'Not sick. GTA 6 is out. My agent is shipping. Sending this to my manager anyway.',
});

const SIGN_OFF = 'Made with /sickday in @CommandCodeAI #GTA6';
export const POST_URL = 'https://commandcode.ai';
const X_MAX_POST = 280;
const X_LINK_COST = 24;

// Things that must never be on a public card, whatever the letter says.
const REDACTIONS = Object.freeze([
	{kind: 'email', pattern: /[\w.+-]+@[\w-]+(\.[\w-]+)+/g},
	{kind: 'url', pattern: /\b(?:https?:\/\/|www\.)\S+/gi},
	{
		kind: 'phone',
		pattern: /\+\d[\d\s().-]{8,}\d|\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,
	},
]);

/**
 * @typedef {1 | 2 | 3 | 4 | 5} Heat
 * @typedef {'email' | 'slack'} Channel
 * @typedef {{from: string, to: string, subject: string, body: string, shipping: string[], heat: Heat, channel: Channel}} Card
 * @typedef {{card: Card, redacted: string[]}} CleanResult
 */

// ---------- input cleaning ----------

/** @param {unknown} value @returns {string} */
function asText(value) {
	if (typeof value !== 'string') return '';
	return undash(value).replace(/\s+/g, ' ').trim();
}

/**
 * Cards never carry em or en dashes: a dash between words becomes a comma.
 * @param {string} text @returns {string}
 */
function undash(text) {
	return text.replace(/[ \t]*[\u2013\u2014][ \t]*/g, ', ');
}

/**
 * Keep the writer's line breaks (greeting, paragraphs, sign-off), collapse
 * other whitespace, and allow at most one blank line in a row.
 * @param {unknown} value
 * @returns {string}
 */
function asMultiline(value) {
	if (typeof value !== 'string') return '';
	return tidy(undash(value.replace(/\r\n?/g, '\n')));
}

/** @param {string} text @returns {string} */
function tidy(text) {
	return text
		.split('\n')
		.map(line =>
			line
				.replace(/\s+/g, ' ')
				.replace(/\s+([,.;:!?])/g, '$1')
				.trim(),
		)
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** @param {string} text @param {number} max @returns {string} */
export function clip(text, max) {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** @param {string} text @returns {{text: string, kinds: string[]}} */
export function redact(text) {
	return REDACTIONS.reduce(
		(acc, {kind, pattern}) => {
			const next = acc.text.replace(pattern, '');
			if (next === acc.text) return acc;
			return {text: tidy(next), kinds: [...acc.kinds, kind]};
		},
		{text, kinds: /** @type {string[]} */ ([])},
	);
}

/** @param {unknown} value @returns {Heat} */
function asHeat(value) {
	const heat = Math.round(Number(value));
	if (!Number.isFinite(heat)) return 3;
	return /** @type {Heat} */ (Math.min(5, Math.max(1, heat)));
}

/** @param {unknown} value @returns {Channel} */
function asChannel(value) {
	return value === 'slack' ? 'slack' : 'email';
}

/**
 * First name only: a card never needs a surname or a handle with an @.
 * @param {unknown} value
 * @returns {string}
 */
function asName(value) {
	const first = asText(value).replace(/^@/, '').split(' ')[0] ?? '';
	return clip(first, LIMITS.name);
}

/**
 * Normalise, redact and clip a card. Throws only when nothing printable is
 * left for the subject or body.
 * @param {Record<string, unknown>} input
 * @returns {CleanResult}
 */
export function cleanCard(input) {
	const subject = redact(asText(input.subject));
	const body = redact(asMultiline(input.body));
	const rawShipping = Array.isArray(input.shipping) ? input.shipping : [];
	const shipping = rawShipping
		.slice(0, LIMITS.shippingItems)
		.map(item => redact(asText(item)));

	if (!subject.text) throw new Error('card.subject is empty');
	if (!body.text) throw new Error('card.body is empty');

	const redacted = [
		...subject.kinds,
		...body.kinds,
		...shipping.flatMap(item => item.kinds),
	];
	return {
		card: {
			from: asName(input.from),
			to: asName(input.to),
			subject: clip(subject.text, LIMITS.subject),
			body: clip(body.text, LIMITS.body),
			shipping: shipping
				.map(item => clip(item.text, LIMITS.shippingItem))
				.filter(Boolean),
			heat: asHeat(input.heat),
			channel: asChannel(input.channel),
		},
		redacted: [...new Set(redacted)],
	};
}

// ---------- X post ----------

/** @param {Heat} heat @returns {string} */
export function buildPostText(heat) {
	return `${HOOKS[heat]}\n\n${SIGN_OFF}`;
}

/**
 * Length as X counts it, with the link (always 23 via t.co) and a space.
 * @param {string} text
 * @returns {number}
 */
export function xLength(text) {
	return [...text].length + X_LINK_COST;
}

/** @param {string} text @returns {boolean} */
export function fitsX(text) {
	return xLength(text) <= X_MAX_POST;
}

/**
 * X web intent: opens the composer pre-filled. The user attaches the card PNG
 * and posts it themselves; nothing here posts on their behalf.
 * @param {{text: string, url: string}} input
 * @returns {string}
 */
export function buildXIntentUrl({text, url}) {
	const params = new URLSearchParams({text, url});
	// URLSearchParams writes spaces as '+'; use the percent form X expects.
	return `https://x.com/intent/post?${params.toString().replace(/\+/g, '%20')}`;
}

// ---------- SVG ----------

/** @param {string} text @returns {string} */
export function escapeXml(text) {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** @param {number} width @param {number} size @returns {number} */
export function charsPerLine(width, size) {
	return Math.floor(width / (size * MONO_ADVANCE));
}

/** @param {string} word @param {number} size @returns {string[]} */
function chunk(word, size) {
	if (word.length <= size) return [word];
	return [word.slice(0, size), ...chunk(word.slice(size), size)];
}

/**
 * How many leading words fit on one line (always at least one).
 * @param {string[]} words
 * @param {number} maxChars
 * @returns {number}
 */
function lineWordCount(words, maxChars) {
	const ends = words.map(
		(_, index) => words.slice(0, index + 1).join(' ').length,
	);
	const overflow = ends.findIndex(length => length > maxChars);
	if (overflow === -1) return words.length;
	return Math.max(1, overflow);
}

/** @param {string[]} words @param {number} maxChars @returns {string[]} */
function packLines(words, maxChars) {
	if (words.length === 0) return [];
	const count = lineWordCount(words, maxChars);
	return [
		words.slice(0, count).join(' '),
		...packLines(words.slice(count), maxChars),
	];
}

/**
 * Greedy word wrap on a fixed-advance font, hard-breaking words that can never
 * fit, ending in an ellipsis when it runs out of lines.
 * @param {string} text
 * @param {number} maxChars
 * @param {number} maxLines
 * @returns {string[]}
 */
export function wrapText(text, maxChars, maxLines) {
	const lines = text.split('\n').flatMap(paragraph => {
		const words = paragraph
			.split(/\s+/)
			.filter(Boolean)
			.flatMap(word => chunk(word, maxChars));
		if (words.length === 0) return [''];
		return packLines(words, maxChars);
	});
	if (lines.length <= maxLines) return lines;

	const kept = lines.slice(0, maxLines);
	const tail = kept.at(-1) ?? '';
	const trimmed =
		tail.length + 1 > maxChars ? tail.slice(0, maxChars - 1) : tail;
	return [...kept.slice(0, -1), `${trimmed.trimEnd()}…`];
}

/**
 * @typedef {{lines: string[], x: number, y: number, size: number, lineHeight: number, fill: string, weight?: number, spacing?: number}} TextBlock
 */

/** @param {TextBlock} block @returns {string} */
function textBlock(block) {
	const spacing = block.spacing ? ` letter-spacing="${block.spacing}"` : '';
	const weight = block.weight ?? 400;
	return block.lines
		.map(
			(line, index) =>
				`<text x="${block.x}" y="${block.y + index * block.lineHeight}" font-size="${block.size}" font-weight="${weight}" fill="${block.fill}"${spacing}>${escapeXml(line)}</text>`,
		)
		.join('');
}

/**
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} color
 * @param {number} size
 * @returns {string}
 */
function label(text, x, y, color, size) {
	return textBlock({
		lines: [text.toUpperCase()],
		x,
		y,
		size,
		lineHeight: size,
		fill: color,
		weight: 700,
		spacing: size * 0.08,
	});
}

/** @param {string} logoSvg @param {number} x @param {number} y @param {number} height @returns {string} */
function logo(logoSvg, x, y, height) {
	const inner = logoSvg
		.replace(/^[\s\S]*?<svg[^>]*>/, '')
		.replace(/<\/svg>\s*$/, '');
	return `<g transform="translate(${x} ${y}) scale(${height / LOGO_HEIGHT})">${inner}</g>`;
}

/** @returns {string} */
function cornerHandles() {
	const size = 7;
	const spots = [
		[0, 0],
		[CARD_WIDTH - size, 0],
		[0, CARD_HEIGHT - size],
		[CARD_WIDTH - size, CARD_HEIGHT - size],
	];
	return spots
		.map(
			([x, y]) =>
				`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="rgba(245,245,245,0.2)" stroke="${BORDER}"/>`,
		)
		.join('');
}

/** @param {Card} card @returns {string} */
function channelTag(card) {
	const text = card.channel === 'slack' ? 'SLACK DM' : 'EMAIL';
	const size = 13;
	const width = text.length * size * MONO_ADVANCE + text.length * 1.2 + 24;
	const x = LEFT_WIDTH - PAD - width;
	return `<rect x="${x}" y="44" width="${width}" height="30" fill="none" stroke="${BORDER_STRONG}"/>${label(text, x + 12, 64, MUTED, size)}`;
}

/** @param {Card} card @returns {string} */
function addressLine(card) {
	const parts = [
		card.to && `to ${card.to}`,
		card.from && `from ${card.from}`,
	].filter(Boolean);
	if (parts.length === 0) return '';
	return textBlock({
		lines: [parts.join('  ·  ')],
		x: PAD,
		y: 168,
		size: 16,
		lineHeight: 16,
		fill: FAINT,
	});
}

/** @param {Card} card @param {string} logoSvg @returns {string} */
function leftSection(card, logoSvg) {
	const width = LEFT_WIDTH - PAD * 2;
	const subjectSize = 36;
	const subjectLineHeight = 42;
	const subjectTop = 220;
	const subject = wrapText(card.subject, charsPerLine(width, subjectSize), 3);
	const bodySize = 15;
	const bodyLineHeight = 22;
	const bodyTop = subjectTop + subject.length * subjectLineHeight + 14;
	const bodyBottom = CARD_HEIGHT - FOOTER_HEIGHT - 32;
	const bodyLines = Math.max(
		1,
		Math.floor((bodyBottom - bodyTop) / bodyLineHeight) + 1,
	);
	const body = wrapText(card.body, charsPerLine(width, bodySize), bodyLines);

	return [
		logo(logoSvg, PAD, 44, 30),
		channelTag(card),
		label('>_ Out of Office Request', PAD, 136, PURPLE, 22),
		addressLine(card),
		textBlock({
			lines: subject,
			x: PAD,
			y: subjectTop,
			size: subjectSize,
			lineHeight: subjectLineHeight,
			fill: TEXT,
			weight: 700,
		}),
		textBlock({
			lines: body,
			x: PAD,
			y: bodyTop,
			size: bodySize,
			lineHeight: bodyLineHeight,
			fill: MUTED,
		}),
	].join('');
}

/** @param {number} index @returns {{top: number, x: number}} */
function rowFrame(index) {
	return {top: index * ROW_HEIGHT, x: LEFT_WIDTH + 40};
}

/** @returns {string} */
function statusRow() {
	const {top, x} = rowFrame(0);
	return [
		label('Status', x, top + 52, EMERALD, 18),
		textBlock({
			lines: ['AFK'],
			x,
			y: top + 122,
			size: 60,
			lineHeight: 60,
			fill: TEXT,
			weight: 700,
		}),
		`<circle cx="${x + 6}" cy="${top + 156}" r="5" fill="${EMERALD}"/>`,
		textBlock({
			lines: ['Command Code is on shift'],
			x: x + 20,
			y: top + 161,
			size: 16,
			lineHeight: 16,
			fill: FAINT,
		}),
	].join('');
}

/** @param {Card} card @returns {string} */
function shippingRow(card) {
	const {top, x} = rowFrame(1);
	const items =
		card.shipping.length > 0
			? card.shipping
			: ['Whatever is next on the board'];
	const maxChars = charsPerLine(CARD_WIDTH - x - 40 - 22, 16);
	const lines = items.flatMap((item, index) => {
		const y = top + 92 + index * 30;
		const text = wrapText(item, maxChars, 1)[0] ?? '';
		return [
			`<rect x="${x}" y="${y - 11}" width="10" height="10" fill="${PURPLE}" opacity="${0.6 + index * 0.2}"/>`,
			textBlock({
				lines: [text],
				x: x + 22,
				y,
				size: 16,
				lineHeight: 16,
				fill: TEXT,
			}),
		];
	});
	return [
		label("Shipping while I'm out", x, top + 52, PURPLE, 18),
		...lines,
	].join('');
}

/** @param {Card} card @returns {string} */
function heatRow(card) {
	const {top, x} = rowFrame(2);
	const blockWidth = (CARD_WIDTH - x - 40 - 4 * 10) / 5;
	const blocks = [1, 2, 3, 4, 5]
		.map(level => {
			const on = level <= card.heat;
			const height = on ? 30 + level * 4 : 22;
			const left = x + (level - 1) * (blockWidth + 10);
			return `<rect x="${left}" y="${top + 160 - height}" width="${blockWidth}" height="${height}" fill="${on ? AMBER : AMBER_SOFT}"/>`;
		})
		.join('');
	return [
		label('Commitment level', x, top + 52, AMBER, 18),
		textBlock({
			lines: [HEAT_LABELS[card.heat]],
			x,
			y: top + 96,
			size: 28,
			lineHeight: 28,
			fill: TEXT,
			weight: 700,
		}),
		blocks,
	].join('');
}

/** @returns {string} */
function footer() {
	const top = CARD_HEIGHT - FOOTER_HEIGHT;
	const credit = 'made with Command Code · commandcode.ai';
	const creditX = CARD_WIDTH - 40 - credit.length * 14 * MONO_ADVANCE;
	return [
		`<line x1="0" y1="${top}" x2="${CARD_WIDTH}" y2="${top}" stroke="${BORDER}"/>`,
		label('Commitment certified by Command Code', PAD, top + 34, FAINT, 13),
		textBlock({
			lines: [credit],
			x: creditX,
			y: top + 34,
			size: 14,
			lineHeight: 14,
			fill: MUTED,
		}),
	].join('');
}

/**
 * The whole card as a self-contained SVG (no external fonts or images).
 * @param {Card} card
 * @param {string} logoSvg the Command Code wordmark SVG source
 * @returns {string}
 */
export function renderCardSvg(card, logoSvg) {
	const rowLines = [1, 2]
		.map(
			index =>
				`<line x1="${LEFT_WIDTH}" y1="${index * ROW_HEIGHT}" x2="${CARD_WIDTH}" y2="${index * ROW_HEIGHT}" stroke="${BORDER}"/>`,
		)
		.join('');
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" font-family="${CARD_FONT}">`,
		`<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${BLACK}"/>`,
		`<rect x="0.5" y="0.5" width="${CARD_WIDTH - 1}" height="${CARD_HEIGHT - 1}" fill="none" stroke="${BORDER_STRONG}"/>`,
		`<line x1="${LEFT_WIDTH}" y1="0" x2="${LEFT_WIDTH}" y2="${CARD_HEIGHT - FOOTER_HEIGHT}" stroke="${BORDER}"/>`,
		rowLines,
		leftSection(card, logoSvg),
		statusRow(),
		shippingRow(card),
		heatRow(card),
		footer(),
		cornerHandles(),
		'</svg>',
	].join('');
}
