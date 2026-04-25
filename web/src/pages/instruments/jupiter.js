import Head from "next/head";
import dynamic from "next/dynamic";

const PlanetInstrument = dynamic(
  () => import("@/components/instruments/PlanetInstrument"),
  { ssr: false }
);

export default function JupiterPage() {
  return (
    <>
      <Head>
        <title>Jupiter — Observatory</title>
        <meta name="description" content="Jupiter — derived live: Roche limit, Great Red Spot, Galileo entry probe." />
      </Head>
      <div className="fixed inset-0 bg-black">
        <PlanetInstrument name="Jupiter" />
      </div>
    </>
  );
}
