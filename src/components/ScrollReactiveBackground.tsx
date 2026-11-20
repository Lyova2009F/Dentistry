import { motion, useScroll, useSpring, useTransform } from 'motion/react';

export function ScrollReactiveBackground() {
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  });

  // Distinct parallax travel & rotation values driven strictly by GPU transforms
  const orbOneY = useTransform(smoothProgress, [0, 1], ['-8%', '68%']);
  const orbOneX = useTransform(smoothProgress, [0, 0.5, 1], ['65%', '12%', '72%']);
  const orbOneRotate = useTransform(smoothProgress, [0, 1], [0, 140]);

  const orbTwoY = useTransform(smoothProgress, [0, 1], ['75%', '8%']);
  const orbTwoX = useTransform(smoothProgress, [0, 0.5, 1], ['-10%', '55%', '-4%']);
  const orbTwoScale = useTransform(smoothProgress, [0, 0.5, 1], [0.92, 1.18, 0.96]);

  const prismRotate = useTransform(smoothProgress, [0, 1], [-12, 165]);
  const prismY = useTransform(smoothProgress, [0, 1], ['6%', '74%']);

  const gridY = useTransform(smoothProgress, [0, 1], ['0px', '-140px']);
  const waveShiftX = useTransform(smoothProgress, [0, 1], ['-6%', '8%']);

  return (
    <div
      aria-hidden="true"
      data-testid="scroll-reactive-bg"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#F4F8FC]"
    >
      {/* Parallax micro-dot & pearl prism base grid */}
      <motion.div
        style={{ y: gridY }}
        className="absolute -inset-y-48 inset-x-0 bg-prism-grid opacity-85"
      />

      {/* Scroll-traveling luminous sky-cyan caustic halo */}
      <motion.div
        style={{
          top: orbOneY,
          left: orbOneX,
          rotate: orbOneRotate,
        }}
        className="absolute w-[560px] h-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-radial from-sky-300/45 via-cyan-200/25 to-transparent blur-3xl"
      />

      {/* Counter-moving glacial mint & pearl aura */}
      <motion.div
        style={{
          top: orbTwoY,
          left: orbTwoX,
          scale: orbTwoScale,
        }}
        className="absolute w-[620px] h-[460px] -translate-y-1/2 rounded-full bg-radial from-teal-200/45 via-sky-100/30 to-transparent blur-3xl"
      />

      {/* Floating kinetic prism ring visible on scroll in side gutters */}
      <motion.div
        style={{
          top: prismY,
          rotate: prismRotate,
        }}
        className="absolute right-[4%] w-[380px] h-[380px] -translate-y-1/2 opacity-65"
      >
        <svg viewBox="0 0 380 380" fill="none" className="w-full h-full">
          <circle
            cx="190"
            cy="190"
            r="168"
            stroke="rgba(2, 132, 199, 0.22)"
            strokeWidth="1.5"
            strokeDasharray="10 12"
          />
          <circle
            cx="190"
            cy="190"
            r="128"
            stroke="rgba(13, 148, 136, 0.2)"
            strokeWidth="1.25"
          />
          <polygon
            points="190,34 326,268 54,268"
            stroke="rgba(14, 116, 144, 0.15)"
            strokeWidth="1.25"
            fill="rgba(186, 230, 253, 0.08)"
          />
        </svg>
      </motion.div>

      {/* Scroll-reactive diagonal architectural ribbon waves */}
      <motion.svg
        style={{ x: waveShiftX }}
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="none"
        className="absolute inset-0 w-[116%] -left-[8%] h-full opacity-75 animate-ribbon-glide"
      >
        <path
          d="M-60 210 C 310 90, 690 310, 1080 170 C 1270 102, 1400 145, 1520 110"
          stroke="rgba(2, 132, 199, 0.20)"
          strokeWidth="2"
        />
        <path
          d="M-40 520 C 340 400, 720 630, 1140 460 C 1320 390, 1430 430, 1540 395"
          stroke="rgba(13, 148, 136, 0.18)"
          strokeWidth="2"
        />
        <path
          d="M-80 790 C 290 670, 680 860, 1090 720 C 1290 650, 1420 690, 1560 640"
          stroke="rgba(56, 189, 248, 0.22)"
          strokeWidth="1.5"
        />
      </motion.svg>
    </div>
  );
}
