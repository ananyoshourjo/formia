interface Window {
  formiaDesktop?: {
    isDesktop: true;
    platform: string;
    inspectorPreloadUrl: string;
    selectProject: () => Promise<import("@/lib/desktop-contracts").Project | null>;
    openProject: (projectPath: string) => Promise<import("@/lib/desktop-contracts").Project>;
    getProjectServerStatus: () => Promise<import("@/lib/desktop-contracts").ProjectServerStatus>;
    restartProjectServer: () => Promise<{ url: string; metadata: unknown }>;
    stopProjectServer: () => Promise<void>;
    buildWithCodex: (payload: import("@/lib/desktop-contracts").CodexBuildRequest) => Promise<import("@/lib/desktop-contracts").CodexBuildResult>;
    cancelCodexBuild: () => Promise<void>;
    getCodexAvailability: () => Promise<import("@/lib/desktop-contracts").CodexAvailability>;
    getInstalledFonts: () => Promise<string[]>;
    minimizeWindow: () => Promise<void>;
    toggleMaximizeWindow: () => Promise<boolean>;
    isWindowMaximized: () => Promise<boolean>;
    closeWindow: () => Promise<void>;
    onCodexAvailability: (callback: (status: import("@/lib/desktop-contracts").CodexAvailability) => void) => () => void;
    onProjectServerStatus: (callback: (status: import("@/lib/desktop-contracts").ProjectServerStatus) => void) => () => void;
    onCodexStatus: (callback: (status: import("@/lib/desktop-contracts").CodexStatus & { jobId: string }) => void) => () => void;
    versions: Readonly<{
      chrome: string;
      electron: string;
      node: string;
    }>;
  };
}

interface FormiaWebviewElement extends HTMLElement {
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  send(channel: string, ...args: unknown[]): void;
}

interface FormiaWebviewEvent extends Event {
  channel: string;
  args: unknown[];
}

declare namespace React.JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<FormiaWebviewElement>, FormiaWebviewElement> & {
      src?: string;
      preload?: string;
      partition?: string;
      allowpopups?: string;
      webpreferences?: string;
    };
  }
}
