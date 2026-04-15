import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import Head from "next/head";
import dynamic from "next/dynamic";

// WebGPU touches browser globals — keep it out of SSR.
const AtmosphereCanvas = dynamic(
  () => import("@/components/instruments/AtmosphereCanvas"),
  { ssr: false }
);

export default function AtmospherePage() {
  return (
    <>
      <Head>
        <title>Atmosphere — Observatory</title>
        <meta
          name="description"
          content="Five-pass WebGPU atmospheric renderer. Rayleigh and Mie scattering with physically derived coefficients, no parameter tuning."
        />
      </Head>
      <TransitionEffect />
      <main className="mb-16 flex w-full flex-col items-center justify-center dark:text-light">
        <Layout className="pt-16">
          <header className="mb-8">
            <h1 className="text-5xl font-bold md:text-4xl sm:text-3xl">Atmosphere</h1>
            <p className="mt-4 max-w-3xl text-base font-medium md:text-sm">
              A five-pass GPU pipeline: terrain → atmospheric state evolution →
              categorical position resolution → physically-based ray march →
              final render. No artist-tuned scattering parameters. Every
              coefficient derives from atmospheric S-entropy coordinates
              sampled from a precomputed texture.
            </p>
          </header>
          <AtmosphereCanvas />
        </Layout>
      </main>
    </>
  );
}
