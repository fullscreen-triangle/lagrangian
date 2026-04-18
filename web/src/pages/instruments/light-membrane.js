import Head from "next/head";
import dynamic from "next/dynamic";

const LightMembrane = dynamic(
  () => import("@/components/instruments/LightMembrane"),
  { ssr: false }
);

export default function LightMembranePage() {
  return (
    <>
      <Head>
        <title>Light Membrane — Observatory</title>
        <meta
          name="description"
          content="The full celestial-sphere temporal-spectral field S_t(α, δ, ω) — every astronomical observation as a projection."
        />
      </Head>
      <div className="fixed inset-0 bg-black">
        <LightMembrane />
      </div>
    </>
  );
}
