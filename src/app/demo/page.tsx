import type { Metadata } from "next";
import { WebDemoApp } from "@/components/web-demo-app";

export const metadata: Metadata = {
  title: "Formia Demo",
  description: "Try Formia's visual editing workflow in the browser.",
};

export default function DemoPage() {
  return <WebDemoApp />;
}
