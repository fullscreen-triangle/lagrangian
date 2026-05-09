import Head from "next/head";
import ResonantStackInstrument from "@/components/instruments/ResonantStackInstrument";
import TransitionEffect from "@/components/TransitionEffect";

export default function ResonantStackPage() {
  return (
    <>
      <Head>
        <title>Resonant Stack — Observatory</title>
        <meta
          name="description"
          content="Five-fluid spectral stack: Cauchy dispersion, temporal echo delays, the Triple Observation Identity, and composition inflation — all live in the browser."
        />
      </Head>
      <TransitionEffect />
      <ResonantStackInstrument />
    </>
  );
}
