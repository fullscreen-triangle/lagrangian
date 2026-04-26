import Head from "next/head";
import dynamic from "next/dynamic";

const VelaInstrument = dynamic(
  () => import("@/components/instruments/VelaInstrument"),
  { ssr: false }
);

export default function VelaPage() {
  return (
    <>
      <Head>
        <title>Vela SNR — Observatory</title>
        <meta
          name="description"
          content="The Vela supernova remnant: a Type II explosion 11 400 years ago at 287 pc, host to the Vela pulsar. Linked by published archaeoastronomy to the Great Zimbabwe ruins."
        />
      </Head>
      <div className="fixed inset-0 bg-black">
        <VelaInstrument />
      </div>
    </>
  );
}
