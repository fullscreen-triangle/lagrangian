import Head from "next/head";
import dynamic from "next/dynamic";

const StackedFluidInstrument = dynamic(
  () => import("@/components/instruments/StackedFluidInstrument"),
  { ssr: false }
);

export default function LiquidMirrorPage() {
  return (
    <>
      <Head>
        <title>Stacked-Fluid Telescope — Observatory</title>
        <meta
          name="description"
          content="Virtual liquid-mirror telescope: stacked fluids of different refractive indices form a wavelength-indexed transfer tensor. The stack is its own spectrometer."
        />
      </Head>
      <div className="fixed inset-0 bg-black">
        <StackedFluidInstrument />
      </div>
    </>
  );
}
