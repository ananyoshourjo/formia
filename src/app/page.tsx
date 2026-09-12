import { FormiaApp } from "@/components/formia-app";
import { LandingPage } from "@/components/landing-page";

export default function Home() {
  return process.env.FORMIA_ELECTRON_BUILD === "1" ? <FormiaApp /> : <LandingPage />;
}
