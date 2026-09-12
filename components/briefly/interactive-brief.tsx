'use client';
import { useRef } from 'react';
import { motion, useInView, useReducedMotion, useScroll } from 'motion/react';
import type {
  InteractiveBrief as Brief,
  BriefSection,
  BriefSource,
} from '@/lib/interactive-brief';
import styles from './interactive-brief.module.css';
function Section({
  section,
  index,
  sources,
}: {
  section: BriefSection;
  index: number;
  sources: BriefSource[];
}) {
  const ref = useRef<HTMLElement>(null);
  const visible = useInView(ref, { once: true, margin: '150px' });
  const reduced = useReducedMotion();
  return (
    <motion.section
      ref={ref}
      id={'brief-chapter-' + index}
      className={styles.chapter}
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      animate={
        visible
          ? { opacity: 1, y: 0 }
          : { opacity: reduced ? 1 : 0.65, y: reduced ? 0 : 16 }
      }
      transition={{ duration: reduced ? 0 : 0.45 }}
    >
      <span className={styles.kicker}>
        CHAPTER {String(index + 1).padStart(2, '0')}
      </span>
      <h3>{section.title}</h3>
      <p>{section.paragraphs[0]}</p>
      {section.paragraphs.slice(1).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <details className={styles.details}>
        <summary>
          Go deeper - {section.sourceIds.length}{' '}
          {section.sourceIds.length === 1 ? 'source' : 'sources'}
        </summary>
        <ul>
          {section.sourceIds.map((id) => {
            const s = sources.find((s) => s.id === id);
            return s ? (
              <li key={id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  <small>{s.publisher}</small>
                  {s.title}
                </a>
                {[
                  ...new Map(
                    (s.references || []).map((reference) => [
                      reference.url,
                      reference,
                    ]),
                  ).values(),
                ].map((reference) => (
                  <a
                    key={reference.url}
                    href={reference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', marginTop: 8 }}
                  >
                    Supporting reporting: {reference.title}
                  </a>
                ))}
              </li>
            ) : null;
          })}
        </ul>
      </details>
    </motion.section>
  );
}
export default function InteractiveBrief({ brief }: { brief: Brief }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });
  return (
    <div ref={ref} className={styles.reader}>
      <div className={styles.progress} aria-hidden="true">
        <motion.div style={{ scaleX: scrollYProgress }} />
      </div>
      <nav className={styles.contents} aria-label="Brief chapters">
        <span className={styles.kicker}>
          IN THIS BRIEF - ABOUT {brief.estimatedMinutes} MIN READ
        </span>
        <div>
          {brief.sections.map((s, i) => (
            <a key={i} href={'#brief-chapter-' + i}>
              {String(i + 1).padStart(2, '0')} {s.title}
            </a>
          ))}
        </div>
      </nav>
      {brief.sections.map((section, index) => (
        <Section
          key={index}
          section={section}
          index={index}
          sources={brief.sources}
        />
      ))}
      <div className={styles.ending}>
        <span className={styles.kicker}>YOU ARE ALL CAUGHT UP</span>
        <p>
          A little more context.
          <br />A clearer view.
        </p>
        <a href="#briefing-title">Back to your feed</a>
      </div>
    </div>
  );
}
