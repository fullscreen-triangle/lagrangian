import AnimatedText from "@/components/AnimatedText";
import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import Head from "next/head";

export default function About() {
  return (
    <>
      <Head>
        <title>About — Observatory</title>
        <meta
          name="description"
          content="Background on the framework, authorship, and attribution."
        />
      </Head>
      <TransitionEffect />
      <main className="flex w-full flex-col items-center justify-center dark:text-light">
        <Layout className="pt-16">
          <AnimatedText
            text="About"
            className="mb-16 !text-6xl lg:!text-5xl md:!text-4xl sm:!text-3xl"
          />
          <div className="grid w-full grid-cols-8 gap-16 md:grid-cols-6">
            <div className="col-span-8 flex flex-col items-start justify-start">
              <h2 className="mb-4 text-lg font-bold uppercase text-dark/75 dark:text-light/75">
                The framework
              </h2>
              <p className="font-medium max-w-4xl mb-6">
                This site hosts a family of scientific instruments built on a
                single observation: a GPU fragment shader evaluating a scalar
                field over a geometric path performs the same numerical
                operation that a physical instrument performs when its
                observable is a path integral over conserved state.
                That is, computing and observing are not distinguishable
                operations at the level of what the machine does. We exploit
                the identity directly.
              </p>
              <h2 className="mb-4 mt-4 text-lg font-bold uppercase text-dark/75 dark:text-light/75">
                The delivery
              </h2>
              <p className="font-medium max-w-4xl mb-6">
                Everything here is static. There is no backend. The page you
                are reading is pure HTML and JavaScript shipped from a CDN,
                plus WGSL shader source and a small set of precomputed
                textures. When you open an instrument, your browser compiles
                the shaders on your GPU and executes them locally. The page
                never talks to a server to compute your result.
              </p>
              <h2 className="mb-4 mt-4 text-lg font-bold uppercase text-dark/75 dark:text-light/75">
                Authorship and references
              </h2>
              <p className="font-medium max-w-4xl mb-2">
                Framework and software: Kundai Farai Sachikonye.
              </p>
              <p className="font-medium max-w-4xl mb-6">
                Supporting papers: <em>Shader-Based Astronomy</em> and
                {" "}
                <em>Dimensionless Reduction of the Gravitational Constant</em>.
                Both papers are available on the Documentation page, together
                with their validation outputs and source code.
              </p>
            </div>
          </div>
        </Layout>
      </main>
    </>
  );
}
