import Head from "next/head";
import dynamic from "next/dynamic";

const PlanetInstrument = dynamic(
  () => import("@/components/instruments/PlanetInstrument"),
  { ssr: false }
);

export default function SaturnPage() {
  return (
    <>
      <Head>
        <title>Saturn — Observatory</title>
        <meta name="description" content="Saturn — derived live: ring system, Roche limit, north polar hexagon." />
      </Head>
      <div className="fixed inset-0 bg-black">
        <PlanetInstrument name="Saturn" />
      </div>
    </>
  );
}
