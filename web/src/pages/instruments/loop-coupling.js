import Head from "next/head";
import dynamic from "next/dynamic";
import {
  BackToHub,
  InstrumentTitle,
} from "@/components/InstrumentChrome";

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
          content="Multi-source resolution via path-multiplexed rays through polyatomic molecular resonators."
        />
      </Head>
      <div className="fixed inset-0 bg-black text-white overflow-auto">
        <BackToHub />
        <InstrumentTitle name="Loop Coupling" />
        <div className="min-h-screen pt-20 pb-12 px-8 md:px-4">
          <div className="max-w-5xl mx-auto">
            <LoopCouplingDemo />
          </div>
        </div>
      </div>
    </>
  );
}
