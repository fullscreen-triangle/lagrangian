import Link from "next/link";
import React from "react";
import Layout from "./Layout";

const Footer = () => (
  <footer
    className="w-full border-t-2 border-solid border-dark
    font-medium text-lg dark:text-light dark:border-light sm:text-base"
  >
    <Layout className="py-8 flex items-center justify-between lg:flex-col lg:py-6">
      <span>{new Date().getFullYear()} Observatory — Kundai Farai Sachikonye</span>
      <span className="font-mono text-sm text-dark/70 dark:text-light/70">
        Computation happens in your browser.
      </span>
      <Link
        href="/documentation/"
        className="underline underline-offset-2"
      >
        Documentation
      </Link>
    </Layout>
  </footer>
);

export default Footer;
