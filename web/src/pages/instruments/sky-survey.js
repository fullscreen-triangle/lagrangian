import Head from "next/head";
import dynamic from "next/dynamic";

const SkySurvey = dynamic(
  () => import("@/components/instruments/SkySurvey"),
  { ssr: false }
);

export default function SkySurveyPage() {
  return (
    <>
      <Head>
        <title>Sky Survey — Observatory</title>
        <meta
          name="description"
          content="A live sky from any latitude: stars, planets, Moon, satellites, and debris. Click any object to analyse."
        />
      </Head>
      <div className="fixed inset-0 bg-black">
        <SkySurvey />
      </div>
    </>
  );
}
