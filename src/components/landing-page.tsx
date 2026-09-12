import Image from "next/image";
import Link from "next/link";
import { ArrowUpRightIcon, DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { windowsInstallerUrl } from "@/lib/release";
import styles from "./landing-page.module.css";

export function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/" aria-label="Formia home">
            <Image src="/landing/ananyo-mark.svg" alt="" width={48} height={48} priority />
          </Link>
        </header>

        <section className={styles.hero} aria-labelledby="formia-title">
          <h1 id="formia-title">Formia</h1>
          <p className={styles.intro}>Shape real interfaces by sight, then build the changes back into your project.</p>
          <div className={styles.actions}>
            <Link className={styles.action} href="/demo" target="_blank" rel="noreferrer">
              View Demo <ArrowUpRightIcon aria-hidden="true" />
            </Link>
            <a className={`${styles.action} ${styles.secondary}`} href={windowsInstallerUrl}>
              <DownloadSimpleIcon aria-hidden="true" /> Download for Windows
            </a>
          </div>
        </section>

        <figure className={styles.productShot}>
          <Image
            src="/landing/formia-workspace.png"
            alt="Formia editing a dashboard with layers, a live canvas, and layout controls"
            width={1919}
            height={1079}
            priority
          />
        </figure>

        <hr className={styles.rule} />
        <section className={styles.contact}>
          <p>Reach out to me at</p>
          <a className={styles.email} href="mailto:mail@ananyoshourjo.com">mail@ananyoshourjo.com</a>
        </section>
        <p className={styles.copyright}>© 2026, Made by Ananyo Shourjo. All rights reserved.</p>
      </div>
    </main>
  );
}
