export function c(tagName, options, children) {
	if (typeof tagName !== 'string') {
		throw new TypeError('tagName must be a string');
	}
	let opts = options;
	let childs = children;

	if (Array.isArray(options)) {
		childs = options;
		opts = {};
	}

	if (typeof opts !== 'object') {
		opts = {};
	}

	if (!Array.isArray(childs)) {
		childs = [];
	}

	const ele = document.createElement(tagName);
	for (const key in opts) {
		if (!Object.prototype.hasOwnProperty.call(opts, key)) continue;
		if (key.startsWith('on')) {
			ele.addEventListener(key.substring(2), opts[key]);
		} else {
			ele[key] = opts[key];
		}
	}

	for (const child of childs) {
		if (typeof child === 'string') {
			ele.appendChild(document.createTextNode(child));
		} else {
			ele.appendChild(child);
		}
	}

	return ele;
}
