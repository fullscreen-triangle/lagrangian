import AnimatedText from "@/components/AnimatedText";
import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import Head from "next/head";

const PAPERS = [
  {
    title: "Shader-Based Astronomy",
    subtitle:
      "GPU Fragment Shaders as Computational Measurement Apparatus for Celestial Observation",
    claim:
      "A five-pass WebGPU pipeline reproduces ten reference astronomical observables at sub-percent precision, at 52 Hz on consumer hardware. No optical aperture required.",
    validation:
      "10 / 10 benchmarks pass, median relative error 6.9 × 10⁻⁵, maximum 4.3 × 10⁻³.",
    pdf: "/papers/shader-based-astronomy.pdf",
  },
  {
    title: "Dimensionless Reduction of the Gravitational Constant",
    subtitle:
      "A Framework for G as a Computable Quantity from Bounded Phase-Space Partition Structure",
    claim:
      "Newton's gravitational constant admits three independent derivation routes within the framework. The three converge to a shared value with precision (d+1)⁻ⁿ at oscillation depth n, reproducing CODATA 2018 at n = 8 (1.1 ns of caesium integration).",
    validation:
      "43 / 43 benchmarks pass across composition, angular resolution, three-route convergence, and cosmology.",
    pdf: "/papers/universal-partition-depth-observatory.pdf",
  },
];

export default function Documentation() {
  return (
    <>
      <Head>
        <title>Documentation — Observatory</title>
        <meta
          name="description"
          content="Papers, validation reports, and references for the observatory framework."
        />
      </Head>
      <TransitionEffect />
      <main className="mb-16 flex w-full flex-col items-center justify-center dark:text-light">
        <Layout className="pt-16">
          <AnimatedText
            text="Documentation"
            className="mb-12 !text-6xl lg:!text-5xl md:!text-4xl sm:!text-3xl"
          />
          <div className="grid gap-10 md:grid-cols-1 grid-cols-2">
            {PAPERS.map((p) => (
              <article
                key={p.title}
                className="relative flex flex-col rounded-2xl border border-solid border-dark/50 dark:border-light/50
                bg-light dark:bg-dark p-8 shadow-lg hover:shadow-xl transition-shadow"
              >
                <h3 className="text-2xl font-bold leading-tight">{p.title}</h3>
                <p className="mt-2 text-sm uppercase tracking-wide text-dark/70 dark:text-light/70">
                  {p.subtitle}
                </p>
                <p className="mt-6 font-medium">{p.claim}</p>
                <p className="mt-4 font-mono text-sm text-dark/80 dark:text-light/80">
                  {p.validation}
                </p>
                <a
                  href={p.pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-block rounded-md border-2 border-dark dark:border-light
                  px-4 py-2 text-sm font-semibold capitalize
                  hover:bg-dark hover:text-light dark:hover:bg-light dark:hover:text-dark"
                >
                  Open paper (PDF)
                </a>
              </article>
            ))}
          </div>
        </Layout>
      </main>
    </>
  );
}
