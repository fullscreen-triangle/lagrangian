import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import "@/styles/globals.css";
import { AnimatePresence } from "framer-motion";
import { Montserrat } from "next/font/google";
import Head from "next/head";
import { useRouter } from "next/router";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-mont" });

// A path matches an instrument *page* when it's under /instruments/<slug>/.
// The instrument hub itself (/instruments/ or /instruments) keeps the chrome.
function isInstrumentPage(asPath) {
  const p = asPath.split(/[?#]/)[0].replace(/\/$/, "");
  return p.startsWith("/instruments/") && p !== "/instruments";
}

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const fullscreen = isInstrumentPage(router.asPath);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main
        className={`${montserrat.variable} font-mont bg-dark text-light w-full ${
          fullscreen ? "h-screen overflow-hidden" : "min-h-screen h-full"
        }`}
      >
        {!fullscreen && <Navbar />}
        <AnimatePresence initial={false} mode="wait">
          <Component key={router.asPath} {...pageProps} />
        </AnimatePresence>
        {!fullscreen && <Footer />}
      </main>
    </>
  );
}
