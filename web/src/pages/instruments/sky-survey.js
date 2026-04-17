import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import Head from "next/head";
import dynamic from "next/dynamic";

const SkySurvey = dynamic(
  () => import("@/components/instruments/SkySurvey"),
  { ssr: false }
);

export default function SkySurveyPage() {
  return (
    <>
      <Head>
        <title>Sky Survey — Observatory</title>
        <meta
          name="description"
          content="Point-source astronomy through a single looped optical ray. Select stars on a procedural sky; the framework resolves all of them simultaneously via a molecular resonator."
        />
      </Head>
      <TransitionEffect />
      <main className="mb-16 flex w-full flex-col items-center justify-center dark:text-light">
        <Layout className="pt-16">
          <header className="mb-8">
            <h1 className="text-5xl font-bold md:text-4xl sm:text-3xl">
              Sky Survey
            </h1>
            <p className="mt-4 max-w-3xl text-base font-medium md:text-sm">
              A procedural sky rendered in your browser. Click stars to add
              them to an aperture. The framework&apos;s single looped ray
              through a molecular resonator resolves all selected sources
              simultaneously, up to the resonator&apos;s cycle-rank capacity.
              No telescope, no mount, no network.
            </p>
          </header>
          <SkySurvey />
        </Layout>
      </main>
    </>
  );
}
