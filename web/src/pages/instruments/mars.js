import Head from "next/head";
import dynamic from "next/dynamic";

const PlanetInstrument = dynamic(
  () => import("@/components/instruments/PlanetInstrument"),
  { ssr: false }
);

export default function MarsPage() {
  return (
    <>
      <Head>
        <title>Mars — Observatory</title>
        <meta name="description" content="Mars — derived live: 17 landing sites, atmospheric scale height, polar cap frost line." />
      </Head>
      <div className="fixed inset-0 bg-black">
        <PlanetInstrument name="Mars" />
      </div>
    </>
  );
}
