import type { PickKeys, WritableKeys } from 'ts-essentials';

// biome-ignore lint/complexity/noBannedTypes: We really want all functions here
export type WithoutFunctions<T> = Omit<T, PickKeys<T, Function>>;
export type OnlyWritable<T extends {}> = Pick<T, WritableKeys<T>>;
export type HtmlProps<T extends HTMLElement> = WithoutFunctions<
	OnlyWritable<T>
>;

export type HTMLEvents = {
	[Ev in keyof HTMLElementEventMap as `on${Ev}`]: (
		param: HTMLElementEventMap[Ev]
	) => void;
};

export function c<K extends keyof HTMLElementTagNameMap>(
	tagName: K,
	options: Partial<HtmlProps<HTMLElementTagNameMap[K]> & HTMLEvents>,
	children: Array<Node | string>
): HTMLElementTagNameMap[K];

export function c<K extends keyof HTMLElementTagNameMap>(
	tagName: K,
	options: Partial<HtmlProps<HTMLElementTagNameMap[K]> & HTMLEvents>
): HTMLElementTagNameMap[K];

export function c<K extends keyof HTMLElementTagNameMap>(
	tagName: K,
	children: Array<Node | string>
): HTMLElementTagNameMap[K];

export function c<K extends keyof HTMLElementTagNameMap>(
	tagName: K
): HTMLElementTagNameMap[K];
