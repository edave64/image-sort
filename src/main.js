// @ts-check
/// <reference types="vite/client" />

export let UI = {
	/** @type {HTMLCanvasElement|null} */
	canvas: null,
	/** @type {HTMLInputElement|null} */
	descending: null,
	/** @type {HTMLSelectElement|null} */
	sortDirection: null,
	/** @type {HTMLSelectElement|null} */
	sortBy: null,

	/** @type {ImageBitmap|null} */
	lastLoadedBitmap: null,

	/**
	 *
	 */
	init() {
		window.UI = UI;
		UI.DND.init();
		UI.canvas = document.getElementsByTagName('canvas')[0];
		UI.descending = /** @type {HTMLInputElement|null} */ (
			document.getElementById('descending')
		);
		UI.sortDirection = /** @type {HTMLSelectElement|null} */ (
			document.getElementById('sortDirection')
		);
		UI.sortBy = /** @type {HTMLSelectElement|null} */ (
			document.getElementById('sortBy')
		);

		document.getElementById('exec')?.addEventListener('click', UI.sort);
		document.getElementById('restore')?.addEventListener('click', UI.restore);
		document.addEventListener('paste', UI.pasteListener);
		document
			.getElementById('upload')
			?.addEventListener('change', UI.fileUploaderListener);
	},

	dispose() {
		UI.DND.dispose();
		document.removeEventListener('paste', UI.pasteListener);
		document.getElementById('exec')?.removeEventListener('click', UI.sort);
		document
			.getElementById('restore')
			?.removeEventListener('click', UI.restore);
		document
			.getElementById('upload')
			?.removeEventListener('change', UI.fileUploaderListener);
	},

	/**
	 * @param {Event} e
	 */
	fileUploaderListener(e) {
		const uploadInput = /** @type {HTMLInputElement|null} */ (
			document.getElementById('upload')
		);
		if (!uploadInput || !uploadInput.files) return;
		for (const file of uploadInput.files) {
			UI.loadFile(file);
		}
		uploadInput.value = '';
	},

	/**
	 * @param {ClipboardEvent} e
	 */
	pasteListener(e) {
		const files = e.clipboardData?.files;
		if (!files) return;
		for (const file of files) {
			UI.loadFile(file);
		}
	},

	/**
	 * @param {File} file
	 */
	async loadFile(file) {
		const { canvas, ctx } = UI.getContext();
		const bitmap = await createImageBitmap(file);
		UI.lastLoadedBitmap = bitmap;
		canvas.height = bitmap.height;
		canvas.width = bitmap.width;

		ctx.drawImage(bitmap, 0, 0);
	},

	getOptions() {
		return {
			descending: this.descending?.checked ?? false,
			sortType: this.sortDirection?.value ?? 'global',
			sortBy: this.sortBy?.value ?? 'rgba',
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

	restore() {
		if (UI.lastLoadedBitmap) {
			const { ctx, canvas } = UI.getContext();
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(UI.lastLoadedBitmap, 0, 0);
		}
	},

	async sort() {
		let { sortType, sortBy } = UI.getOptions();
		const { canvas, ctx } = UI.getContext();

		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const buffer = imageData.data;
		const orderBuffer = new Uint32Array(new ArrayBuffer(buffer.byteLength));
		const origBuffer = new DataView(buffer.buffer);
		let littleEndian = false;

		if (sortBy === 'abgr') {
			sortBy = 'rgba';
			littleEndian = true;
		}

		for (let i = 0; i < orderBuffer.length; ++i) {
			orderBuffer[i] = origBuffer.getUint32(i * 4, littleEndian);
		}

		const { descending } = UI.getOptions();
		const sortValue = UI.SortValues[sortBy];

		/** @type {(a: number, b: number) => number} */
		const comparator = descending
			? (a, b) => sortValue(b) - sortValue(a)
			: (a, b) => sortValue(a) - sortValue(b);

		UI.Sorters[sortType](orderBuffer, comparator, canvas.width, canvas.height);

		for (let i = 0; i < orderBuffer.length; ++i) {
			origBuffer.setUint32(i * 4, orderBuffer[i], littleEndian);
		}

		ctx.putImageData(imageData, 0, 0);
	},

	/**
	 * @type {Record<string, (data: Uint32Array, comparator: (a: number, b: number) => number, width: number, height: number) => void>}
	 */
	Sorters: {
		global(data, comparator, width, height) {
			data.sort(comparator);
		},
		line(data, comparator, width, height) {
			for (let y = 0; y < height; ++y) {
				const slice = data.subarray(y * width, (1 + y) * width);
				slice.sort(comparator);
			}
		},
		column(data, comparator, width, height) {
			for (let x = 0; x < width; ++x) {
				const slice = new Uint32Array(height);
				// collect column
				for (let y = 0; y < height; ++y) {
					slice[y] = data[y * width + x];
				}
				slice.sort(comparator);
				// reinsert sorted
				for (let y = 0; y < height; ++y) {
					data[y * width + x] = slice[y];
				}
			}
		},
	},

	/**
	 * @type {Record<string, (rgba: number) => number>}
	 */
	SortValues: {
		rgba(rgba) {
			return rgba;
		},
		red(rgba) {
			return (rgba & 0xff000000) >>> 24;
		},
		green(rgba) {
			return (rgba & 0x00ff0000) >>> 16;
		},
		blue(rgba) {
			return (rgba & 0x0000ff00) >>> 8;
		},
		alpha(rgba) {
			return rgba & 0x000000ff;
		},
		hue(rgba) {
			const r = UI.SortValues.red(rgba);
			const g = UI.SortValues.green(rgba);
			const b = UI.SortValues.blue(rgba);
			const cmin = Math.min(r, g, b);
			const cmax = Math.max(r, g, b);
			const delta = cmax - cmin;
			let h = 0;

			if (delta === 0) {
				h = 0;
				// Red is max
			} else if (cmax === r) {
				h = ((g - b) / delta) % 6;
				// Green is max
			} else if (cmax === g) {
				h = (b - r) / delta + 2;
				// Blue is max
			} else {
				h = (r - g) / delta + 4;
			}

			h = Math.round(h * 60);

			// Make negative hues positive behind 360°
			if (h < 0) h += 360;
			return h;
		},
		saturation(rgba) {
			const r = UI.SortValues.red(rgba);
			const g = UI.SortValues.green(rgba);
			const b = UI.SortValues.blue(rgba);
			const cmin = Math.min(r, g, b);
			const cmax = Math.max(r, g, b);
			const delta = cmax - cmin;
			const l = (cmax + cmin) / 2;
			const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
			return s;
		},
		lightness(rgba) {
			const r = UI.SortValues.red(rgba);
			const g = UI.SortValues.green(rgba);
			const b = UI.SortValues.blue(rgba);
			const cmin = Math.min(r, g, b);
			const cmax = Math.max(r, g, b);
			const l = (cmax + cmin) / 2;
			return l;
		},
	},

	DND: {
		init() {
			document.addEventListener('drop', UI.DND.dropListener);
			document.addEventListener('dragover', UI.DND.dragOverListener);
		},
		dispose() {
			document.removeEventListener('drop', UI.DND.dropListener);
			document.removeEventListener('dragover', UI.DND.dragOverListener);
		},
		/**
		 * @param {DragEvent} e
		 */
		dropListener(e) {
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
		},
		/**
		 * @param {DragEvent} e
		 */
		dragOverListener(e) {
			e.preventDefault();
		},
	},
};

if (document.readyState === 'complete') {
	UI.init();
} else {
	document.addEventListener('DOMContentLoaded', () => UI.init());
}

if (import.meta.hot) {
	import.meta.hot.accept((newModule) => {
		if (newModule) {
			// Disconnect old event listeners
			UI.dispose();
			newModule.UI.lastLoadedBitmap = UI.lastLoadedBitmap;
			UI = newModule.UI;
		}
	});
}
