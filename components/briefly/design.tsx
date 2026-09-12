'use client';
import { MotionConfig, motion } from 'motion/react';
import Link from 'next/link';
import { ArrowUpRight, AudioLines } from 'lucide-react';
import type { ReactNode } from 'react';
import { FlowPaths } from '@/components/kokonutui/flow-paths';
export function FlowShell({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 170, damping: 25 }}><main className="flow-shell"><FlowPaths />{children}<footer className="flow-footer"><span className="wordmark">briefly</span><span>A LITTLE NEWS. A LOT MORE YOU.</span><a href="#top" aria-label="Back to top"><ArrowUpRight /></a></footer></main></MotionConfig>;
}
export function Brand() { return <Link href="/" className="wordmark" aria-label="Briefly home">briefly</Link>; }
export function FlowHero({ feed = false }: { feed?: boolean }) {
  return <section className="flow-hero"><div className="eyebrow"><span className="signal-dot" />PERSONAL NEWS. ON YOUR WAVELENGTH.</div>
    <motion.h1 initial={{ opacity: 1, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>{feed ? <>YOUR WORLD.<br /><span className="outline-type">IN MOTION.</span></> : <>LESS NOISE.<br /><span className="outline-type">MORE SIGNAL.</span></>}</motion.h1>
    <div className="hero-caption"><p>{feed ? 'A fresh perspective on the things you follow. Shape your feed with every story.' : 'The world keeps moving. Find the stories that move you, all in one personal daily feed.'}</p><span className="hero-stamp"><AudioLines aria-hidden="true" /><span>TUNED<br />TO YOU</span></span></div>
  </section>;
}
