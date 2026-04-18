import Head from "next/head";
import dynamic from "next/dynamic";

const SolarSystem = dynamic(
  () => import("@/components/instruments/SolarSystem"),
  { ssr: false }
);

export default function SolarSystemPage() {
  return (
    <>
      <Head>
        <title>Solar System — Observatory</title>
        <meta
          name="description"
          content="Eight planets in 3D with live Kepler's-third-law validation."
        />
      </Head>
      <div className="fixed inset-0 bg-black">
        <SolarSystem />
      </div>
    </>
  );
}
