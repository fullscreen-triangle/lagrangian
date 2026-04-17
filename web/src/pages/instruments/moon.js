import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import Head from "next/head";
import dynamic from "next/dynamic";

const MoonInstrument = dynamic(
  () => import("@/components/instruments/MoonInstrument"),
  { ssr: false }
);

export default function MoonPage() {
  return (
    <>
      <Head>
        <title>Moon — Observatory</title>
        <meta
          name="description"
          content="The Moon derived from partition geometry: mass, orbit, libration, regolith depth, tides, moonquakes — computed in your browser, no observational data fed in."
        />
      </Head>
      <TransitionEffect />
      <main className="mb-16 flex w-full flex-col items-center justify-center dark:text-light">
        <Layout className="pt-16">
          <header className="mb-8">
            <h1 className="text-5xl font-bold md:text-4xl sm:text-3xl">
              The Moon
            </h1>
            <p className="mt-4 max-w-3xl text-base font-medium md:text-sm">
              Twelve primary lunar observables — mass, orbital radius, tidal
              periods, libration angles, regolith thickness, moonquake
              periodicity, eclipse cycles — derived from first principles and
              compared against NASA Apollo-era measurements. All numbers
              computed in your browser.
            </p>
          </header>
          <MoonInstrument />
        </Layout>
      </main>
    </>
  );
}
