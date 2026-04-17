import AnimatedText from "@/components/AnimatedText";
import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import Head from "next/head";
import Link from "next/link";

const INSTRUMENTS = [
  {
    slug: "moon",
    name: "The Moon",
    tagline: "Twelve lunar observables derived live — mass, orbit, tides, libration, regolith.",
    status: "live",
  },
  {
    slug: "solar-system",
    name: "Solar System",
    tagline: "Eight planets in 3D with live Kepler-third-law validation.",
    status: "live",
  },
  {
    slug: "sky-survey",
    name: "Sky Survey",
    tagline: "Procedural 3D starfield. Select stars and watch a single ray resolve all of them.",
    status: "live",
  },
  {
    slug: "loop-coupling",
    name: "Loop Coupling",
    tagline: "Multi-source resolution via looped rays through molecular harmonic resonators.",
    status: "live",
  },
  {
    slug: "atmosphere",
    name: "Atmosphere",
    tagline: "Five-pass sky renderer with physically derived Rayleigh and Mie scattering.",
    status: "pending",
  },
  {
    slug: "g-routes",
    name: "G Routes",
    tagline: "Three-route computation of Newton's gravitational constant, live from n.",
    status: "pending",
  },
  {
    slug: "spectrometer",
    name: "Spectrometer",
    tagline: "Hardware-oscillator spectroscopy without a light source.",
    status: "pending",
  },
  {
    slug: "mass-spec",
    name: "Mass Spec",
    tagline: "Force-free ion trajectory via partition-depth minimisation.",
    status: "pending",
  },
];

export default function Instruments() {
  return (
    <>
      <Head>
        <title>Instruments — Observatory</title>
        <meta
          name="description"
          content="Shader-driven scientific instruments running entirely in the browser."
        />
      </Head>
      <TransitionEffect />
      <main className="mb-16 flex w-full flex-col items-center justify-center dark:text-light">
        <Layout className="pt-16">
          <AnimatedText
            text="Instruments"
            className="mb-12 !text-6xl lg:!text-5xl md:!text-4xl sm:!text-3xl"
          />
          <div className="grid grid-cols-2 gap-8 md:grid-cols-1">
            {INSTRUMENTS.map((inst) => {
              const live = inst.status === "live";
              const Card = (
                <div
                  className={`flex h-full flex-col rounded-2xl border-2 border-solid p-8 transition-shadow
                  ${live
                    ? "border-dark dark:border-light hover:shadow-xl cursor-pointer"
                    : "border-dark/30 dark:border-light/30 opacity-60 cursor-not-allowed"}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold">{inst.name}</h3>
                    <span
                      className={`text-xs font-mono uppercase tracking-widest
                      ${live ? "text-green-600 dark:text-green-400" : "text-dark/50 dark:text-light/50"}`}
                    >
                      {inst.status}
                    </span>
                  </div>
                  <p className="mt-4 font-medium">{inst.tagline}</p>
                </div>
              );
              return live ? (
                <Link key={inst.slug} href={`/instruments/${inst.slug}/`}>
                  {Card}
                </Link>
              ) : (
                <div key={inst.slug}>{Card}</div>
              );
            })}
          </div>
        </Layout>
      </main>
    </>
  );
}
