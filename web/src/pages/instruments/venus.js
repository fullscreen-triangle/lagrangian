import Head from "next/head";
import dynamic from "next/dynamic";

const PlanetInstrument = dynamic(
  () => import("@/components/instruments/PlanetInstrument"),
  { ssr: false }
);

export default function VenusPage() {
  return (
    <>
      <Head>
        <title>Venus — Observatory</title>
        <meta name="description" content="Venus — derived live: greenhouse temperature, scale height, retrograde rotation." />
      </Head>
      <div className="fixed inset-0 bg-black">
        <PlanetInstrument name="Venus" />
      </div>
    </>
  );
}
