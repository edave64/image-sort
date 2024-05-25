// @ts-check
/// <reference types="vite/client" />

import { c } from './domHelper';

const UI = {
	canvas: /** @type {HTMLCanvasElement} */ (/** @type {unknown} */ (null)),
	littleEndian: /** @type {HTMLInputElement} */ (/** @type {unknown} */ (null)),
	descending: /** @type {HTMLInputElement} */ (/** @type {unknown} */ (null)),
	sortType: /** @type {HTMLSelectElement} */ (/** @type {unknown} */ (null)),

	/**
	 *
	 */
	init() {
		UI.initDnD();
		const info = document.createElement('p');
		info.innerText = 'Drag an image into this document.';
		document.body.insertBefore(info, document.body.children[0]);
		UI.canvas = document.getElementsByTagName('canvas')[0];

		document.body.append(
			c('p', [
				(UI.littleEndian = c('input', { type: 'checkbox' })),
				c('label', ['Little endian']),
			]),
			c('p', [
				(UI.descending = c('input', { type: 'checkbox' })),
				c('label', ['Descending']),
			]),
			c('p', [
				c('label', ['Sort type']),
				(UI.sortType = c('select', [
					c('option', { value: 'global' }, ['Global']),
					c('option', { value: 'line' }, ['By line']),
					c('option', { value: 'column' }, ['By column']),
				])),
			]),
			c(
				'button',
				{
					onclick(e) {
						UI.sort();
					},
				},
				['Sort']
			)
		);
	},

	/**
	 *
	 */
	initDnD() {
		document.addEventListener('drop', (e) => {
			e.preventDefault();

			if (!e.dataTransfer) return;

			if (e.dataTransfer.items) {
				for (const item of e.dataTransfer.items) {
					if (item.kind !== 'file') continue;
					const file = item.getAsFile();
					if (!file) continue;
					UI.loadFile(file);
					break;
				}
			} else {
				for (const file of e.dataTransfer.files) {
					if (!file) continue;
					UI.loadFile(file);
					break;
				}
			}
		});

		document.addEventListener('dragover', (e) => {
			e.preventDefault();
		});
	},

	/**
	 * @param {File} file
	 */
	async loadFile(file) {
		const bitmap = await createImageBitmap(file);
		try {
			const canvas = UI.canvas;
			canvas.height = bitmap.height;
			canvas.width = bitmap.width;

			const ctx = canvas.getContext('2d');

			if (!ctx) {
				throw new Error('Could not create painting context');
			}

			ctx.drawImage(bitmap, 0, 0);
		} finally {
			bitmap.close();
		}
	},

	getOptions() {
		return {
			littleEndian: this.littleEndian.checked,
			descending: this.descending.checked,
			sortType: this.sortType.value,
		};
	},

	async sort() {
		const { littleEndian, sortType } = UI.getOptions();

		const canvas = UI.canvas;
		const ctx = canvas.getContext('2d');

		if (!ctx) {
			throw new Error('Could not create painting context');
		}

		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const buffer = imageData.data;
		const orderBuffer = new Uint32Array(new ArrayBuffer(buffer.byteLength));
		const origBuffer = new DataView(buffer.buffer);

		for (let i = 0; i < orderBuffer.length; ++i) {
			orderBuffer[i] = origBuffer.getUint32(i * 4, littleEndian);
		}

		UI.Sorters[sortType](orderBuffer, canvas.width, canvas.height);

		for (let i = 0; i < orderBuffer.length; ++i) {
			origBuffer.setUint32(i * 4, orderBuffer[i], littleEndian);
		}

		ctx.putImageData(imageData, 0, 0);
	},

	/**
	 * @type {Record<string, (data: Uint32Array, width: number, height: number) => void>}
	 */
	Sorters: {
		global(data, width, height) {
			const { descending } = UI.getOptions();
			if (descending) {
				data.sort((a, b) => b - a);
			} else {
				data.sort();
			}
		},
		line(data, width, height) {
			const { descending } = UI.getOptions();
			for (let y = 0; y < height; ++y) {
				const slice = data.subarray(y * width, (1 + y) * width);
				if (descending) {
					slice.sort((a, b) => b - a);
				} else {
					slice.sort();
				}
			}
		},
		column(data, width, height) {
			const { descending } = UI.getOptions();
			for (let x = 0; x < width; ++x) {
				const slice = new Uint32Array(height);
				// collect column
				for (let y = 0; y < height; ++y) {
					slice[y] = data[y * width + x];
				}
				if (descending) {
					slice.sort((a, b) => b - a);
				} else {
					slice.sort();
				}
				// reinsert sorted
				for (let y = 0; y < height; ++y) {
					data[y * width + x] = slice[y];
				}
			}
		},
	},
};

if (document.readyState === 'complete') {
	UI.init();
} else {
	document.addEventListener('DOMContentLoaded', () => UI.init());
}
