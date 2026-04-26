import { forwardRef, useEffect, useState } from "react";

/**
 * react-globe.gl loaded client-side, with refs properly forwarded so that
 * imperative methods (controls(), pointOfView(), getGlobeRadius(), …) are
 * reachable via ref.current.
 *
 * Next.js dynamic() does not transparently forward refs through its wrapper,
 * which is why callers consistently saw `globeEl.current.controls is not a
 * function`. This component sidesteps that by importing the module directly
 * inside an effect and rendering the inner component with a real ref.
 */
const Globe = forwardRef(function GlobeForwardRef(props, ref) {
  const [Component, setComponent] = useState(null);
  useEffect(() => {
    let mounted = true;
    import("react-globe.gl").then((mod) => {
      if (mounted) setComponent(() => mod.default);
    });
    return () => { mounted = false; };
  }, []);
  if (!Component) return null;
  return <Component ref={ref} {...props} />;
});

export default Globe;
