import AnimatedText from "@/components/AnimatedText";
import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";

// Three.js touches browser-only globals; render client-side only.
const JupiterModel = dynamic(() => import("@/components/JupiterModel"), {
  ssr: false,
});

export default function Home() {
  return (
    <>
      <Head>
        <title>Observatory — browser-native shader instruments</title>
        <meta
          name="description"
          content="Scientific instruments that run entirely as WebGPU shaders in the browser.
          No backend, no installation. The GPU does the computing."
        />
      </Head>
      <TransitionEffect />
      <article className="flex min-h-screen items-center text-dark dark:text-light sm:items-start">
        <Layout className="!pt-0 md:!pt-16 sm:!pt-16">
          <div className="flex w-full items-center justify-between md:flex-col">
            <div className="w-1/2 lg:hidden md:inline-block md:w-full md:h-[380px] sm:h-[280px] h-[520px]">
              <JupiterModel />
            </div>
            <div className="flex w-1/2 flex-col items-start self-center lg:w-full lg:text-center">
              <AnimatedText
                text="The GPU is the instrument."
                className="!text-left !text-6xl xl:!text-5xl lg:!text-center lg:!text-6xl md:!text-5xl sm:!text-3xl"
              />
              <p className="my-4 max-w-xl text-base font-medium md:text-sm sm:!text-xs">
                A set of scientific instruments that run as WebGPU shaders in
                your browser. They compute the answer — they do not render
                someone else&apos;s computation. There is no backend, no API,
                no server. Open the page, and your hardware becomes the
                observatory.
              </p>
              <div className="mt-2 flex items-center gap-4 self-start flex-wrap lg:self-center">
                <Link
                  href="/instruments/"
                  className="rounded-lg border-2 border-solid bg-dark p-2.5 px-6 text-lg font-semibold
                  capitalize text-light hover:border-dark hover:bg-transparent hover:text-dark
                  dark:bg-light dark:text-dark dark:hover:border-light dark:hover:bg-dark dark:hover:text-light
                  md:p-2 md:px-4 md:text-base"
                >
                  Open the instruments
                </Link>
                <Link
                  href="/documentation/"
                  className="text-lg font-medium capitalize text-dark underline
                  dark:text-light md:text-base"
                >
                  Read the papers
                </Link>
              </div>
            </div>
          </div>
        </Layout>
      </article>
    </>
  );
}
