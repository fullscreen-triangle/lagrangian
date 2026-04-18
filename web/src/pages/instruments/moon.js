import Head from "next/head";
import dynamic from "next/dynamic";

const MoonInstrument = dynamic(
  () => import("@/components/instruments/MoonInstrument"),
  { ssr: false }
);

export default function MoonPage() {
  return (
    <>
      <Head>
        <title>Moon — Observatory</title>
        <meta
          name="description"
          content="The Moon derived live from partition geometry: mass, orbit, libration, regolith, tides, moonquakes."
        />
      </Head>
      <div className="fixed inset-0 bg-black">
        <MoonInstrument />
      </div>
    </>
  );
}
