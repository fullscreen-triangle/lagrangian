import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import Head from "next/head";
import dynamic from "next/dynamic";

const LoopCouplingDemo = dynamic(
  () => import("@/components/instruments/LoopCouplingDemo"),
  { ssr: false }
);

export default function LoopCouplingPage() {
  return (
    <>
      <Head>
        <title>Loop Coupling — Observatory</title>
        <meta
          name="description"
          content="Multi-source resolution via path-multiplexed rays through polyatomic molecular resonators. Transfer-matrix inversion recovering multiple sources from a single looped ray."
        />
      </Head>
      <TransitionEffect />
      <main className="mb-16 flex w-full flex-col items-center justify-center dark:text-light">
        <Layout className="pt-16">
          <header className="mb-8">
            <h1 className="text-5xl font-bold md:text-4xl sm:text-3xl">
              Loop Coupling
            </h1>
            <p className="mt-4 max-w-3xl text-base font-medium md:text-sm">
              A single optical path through a molecular resonator with closed
              harmonic loops resolves multiple independent sources
              simultaneously. The transfer matrix has rank equal to the cycle
              rank of the molecular harmonic graph plus one. Select a molecule,
              set the number of sources and noise level, and watch the
              reconstruction.
            </p>
          </header>
          <LoopCouplingDemo />
        </Layout>
      </main>
    </>
  );
}
