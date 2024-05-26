// @ts-check
/// <reference types="vite/client" />

export let UI = {
	/** @type {HTMLCanvasElement|null} */
	canvas: null,
	/** @type {HTMLInputElement|null} */
	littleEndian: null,
	/** @type {HTMLInputElement|null} */
	descending: null,
	/** @type {HTMLSelectElement|null} */
	sortDirection: null,

	/** @type {ImageBitmap|null} */
	lastLoadedBitmap: null,

	/**
	 *
	 */
	init() {
		UI.DND.init();
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

	restore() {
		if (UI.lastLoadedBitmap) {
			const { ctx, canvas } = UI.getContext();
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(UI.lastLoadedBitmap, 0, 0);
		}
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
