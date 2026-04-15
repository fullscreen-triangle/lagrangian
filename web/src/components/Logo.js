import { motion } from "framer-motion";
import Link from "next/link";
import React from "react";

const MotionLink = motion(Link);

const Logo = () => (
  <div className="flex flex-col items-center justify-center mt-2">
    <MotionLink
      href="/"
      className="flex items-center justify-center rounded-full w-16 h-16 bg-dark text-white
      dark:border-2 dark:border-solid dark:border-light text-2xl font-bold"
      whileHover={{
        backgroundColor: [
          "#121212",
          "rgba(70,120,200,1)",
          "rgba(220,80,60,1)",
          "rgba(130,200,120,1)",
          "#121212",
        ],
        transition: { duration: 1.2, repeat: Infinity },
      }}
      aria-label="Home"
    >
      OBS
    </MotionLink>
  </div>
);

export default Logo;
