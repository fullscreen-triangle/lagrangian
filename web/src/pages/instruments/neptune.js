import Head from "next/head";
import dynamic from "next/dynamic";

const PlanetInstrument = dynamic(
  () => import("@/components/instruments/PlanetInstrument"),
  { ssr: false }
);

export default function NeptunePage() {
  return (
    <>
      <Head>
        <title>Neptune — Observatory</title>
        <meta name="description" content="Neptune — derived live: 580 m/s peak winds, Triton orbital decay, Voyager 2 flyby." />
      </Head>
      <div className="fixed inset-0 bg-black">
        <PlanetInstrument name="Neptune" />
      </div>
    </>
  );
}
