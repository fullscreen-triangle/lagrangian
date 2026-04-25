import Head from "next/head";
import dynamic from "next/dynamic";

const PlanetInstrument = dynamic(
  () => import("@/components/instruments/PlanetInstrument"),
  { ssr: false }
);

export default function UranusPage() {
  return (
    <>
      <Head>
        <title>Uranus — Observatory</title>
        <meta name="description" content="Uranus — derived live: 97.77° axial tilt, magnetic offset, Voyager 2 flyby." />
      </Head>
      <div className="fixed inset-0 bg-black">
        <PlanetInstrument name="Uranus" />
      </div>
    </>
  );
}
