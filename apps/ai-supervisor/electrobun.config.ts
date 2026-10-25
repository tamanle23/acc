export interface ElectrobunConfig {
  app: {
    name: string;
    identifier: string;
    version: string;
  };
  build: {
    mainProcess: string;
    views: Record<string, { entrypoint: string }>;
    copy?: Record<string, string>;
  };
  runtime: {
    exitOnLastWindowClosed: boolean;
  };
}

const config: ElectrobunConfig = {
  app: {
    name: "ACC Control Plane",
    identifier: "com.acc.ai-supervisor",
    version: "1.0.0",
  },
  build: {
    mainProcess: "bun",
    views: {
      main: { entrypoint: "src/views/index.html" },
    },
    copy: {
      "src/views/index.html": "views/main/index.html",
      "src/assets/tray-green.ico": "views/main/tray-green.ico",
      "src/assets/tray-yellow.ico": "views/main/tray-yellow.ico",
      "src/assets/tray-red.ico": "views/main/tray-red.ico",
    },
  },
  runtime: {
    exitOnLastWindowClosed: false,
  },
};

export default config;
