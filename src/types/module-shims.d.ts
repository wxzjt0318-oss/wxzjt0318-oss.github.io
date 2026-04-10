declare module "*.astro" {
	const Component: any;
	export default Component;
}

declare module "*.svelte" {
	const Component: any;
	export default Component;
}

declare module "*.json" {
	const value: any;
	export default value;
}
