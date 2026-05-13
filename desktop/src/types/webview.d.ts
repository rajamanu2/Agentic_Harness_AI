import type { DetailedHTMLProps, HTMLAttributes, Ref } from "react";

type WebviewProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  allowpopups?: string;
  partition?: string;
  ref?: Ref<HTMLElement>;
  src?: string;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: WebviewProps;
    }
  }
}

export {};
