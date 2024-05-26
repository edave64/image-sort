// @ts-check
/// <reference types="vite/client" />

const UI = {
	/** @type {HTMLCanvasElement|null} */
	canvas: null,
	/** @type {HTMLInputElement|null} */
	littleEndian: null,
	/** @type {HTMLInputElement|null} */
	descending: null,
	/** @type {HTMLSelectElement|null} */
	sortDirection: null,

	/**
	 *
	 */
	init() {
		UI.initDnD();
		UI.canvas = document.getElementsByTagName('canvas')[0];
		UI.littleEndian = /** @type {HTMLInputElement|null} */ (
			document.getElementById('littleEndian')
		);
		UI.descending = /** @type {HTMLInputElement|null} */ (
			document.getElementById('descending')
		);
		UI.sortDirection = /** @type {HTMLSelectElement|null} */ (
			document.getElementById('sortDirection')
		);

		document.getElementById('exec')?.addEventListener('click', UI.sort);
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
		const { canvas, ctx } = UI.getContext();
		const bitmap = await createImageBitmap(file);
		try {
			canvas.height = bitmap.height;
			canvas.width = bitmap.width;

			ctx.drawImage(bitmap, 0, 0);
		} finally {
			bitmap.close();
		}
	},

	getOptions() {
		return {
			littleEndian: this.littleEndian?.checked ?? false,
			descending: this.descending?.checked ?? false,
			sortType: this.sortDirection?.value ?? 'global',
		};
	},

	getContext() {
		const canvas = UI.canvas;

		if (!canvas) {
			throw new Error('Canvas is gone?');
		}

		const ctx = canvas.getContext('2d');

		if (!ctx) {
			throw new Error('Could not create painting context');
		}

		return { canvas, ctx };
	},

	async sort() {
		const { littleEndian, sortType } = UI.getOptions();
		const { canvas, ctx } = UI.getContext();

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
