import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import Head from "next/head";
import dynamic from "next/dynamic";

const SolarSystem = dynamic(
  () => import("@/components/instruments/SolarSystem"),
  { ssr: false }
);

export default function SolarSystemPage() {
  return (
    <>
      <Head>
        <title>Solar System — Observatory</title>
        <meta
          name="description"
          content="Live Kepler's-third-law validation across the eight planets. Semi-major axes derived from observed orbital periods, rendered on a compressed 3D scene."
        />
      </Head>
      <TransitionEffect />
      <main className="mb-16 flex w-full flex-col items-center justify-center dark:text-light">
        <Layout className="pt-16">
          <header className="mb-8">
            <h1 className="text-5xl font-bold md:text-4xl sm:text-3xl">
              Solar System
            </h1>
            <p className="mt-4 max-w-3xl text-base font-medium md:text-sm">
              Eight planets at orbital distances derived from the
              framework&apos;s Kepler-third-law form, rendered in 3D and
              animated at a time scale you control. Click any planet to
              inspect its derived parameters and their agreement with
              observation.
            </p>
          </header>
          <SolarSystem />
        </Layout>
      </main>
    </>
  );
}
