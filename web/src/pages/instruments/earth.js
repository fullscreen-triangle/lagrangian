import Head from "next/head";
import dynamic from "next/dynamic";

const PlanetInstrument = dynamic(
  () => import("@/components/instruments/PlanetInstrument"),
  { ssr: false }
);

export default function EarthPage() {
  return (
    <>
      <Head>
        <title>Earth — Observatory</title>
        <meta name="description" content="Earth — derived live: scale height, surface temperature, lunar Hill sphere." />
      </Head>
      <div className="fixed inset-0 bg-black">
        <PlanetInstrument name="Earth" />
      </div>
    </>
  );
}
