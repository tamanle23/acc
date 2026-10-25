import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "acc-desktop",
		identifier: "dev.acc.desktop",
		version: "1.0.0",
	},
	build: {
		mainProcess: "cottontail",
		cottontail: {
			entrypoint: "src/bun/index.ts",
		},
		views: {},
		copy: {
			"resources/console-web": "views/electron-web",
		},
		mac: {
			bundleCEF: false,
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
