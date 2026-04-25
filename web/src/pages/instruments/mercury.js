import Head from "next/head";
import dynamic from "next/dynamic";

const PlanetInstrument = dynamic(
  () => import("@/components/instruments/PlanetInstrument"),
  { ssr: false }
);

export default function MercuryPage() {
  return (
    <>
      <Head>
        <title>Mercury — Observatory</title>
        <meta name="description" content="Mercury — derived live: 3:2 spin–orbit resonance, perihelion advance, surface flux." />
      </Head>
      <div className="fixed inset-0 bg-black">
        <PlanetInstrument name="Mercury" />
      </div>
    </>
  );
}
