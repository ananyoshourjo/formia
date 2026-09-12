import type { Metadata } from "next";
import { FormiaApp } from "@/components/formia-app";

export const metadata: Metadata = {
  title: "Formia Demo",
  description: "Try Formia's visual editing workflow in the browser.",
};

export default function DemoPage() {
  return <FormiaApp />;
}
