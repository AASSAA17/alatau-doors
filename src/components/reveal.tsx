'use client';
import { motion, useReducedMotion } from 'motion/react';
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: reduced ? 0 : 0.55 }}
      whileHover={reduced ? undefined : { y: -2 }}
    >
      {children}
    </motion.div>
  );
}
