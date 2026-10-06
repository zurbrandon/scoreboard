// Full-screen logo scene. Shows the live logo image with its website small
// underneath. Falls back to the logo's name if the image is missing. On a
// reveal (animate), the logo slams in (Motion spring) and the website staggers
// in per character.

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import type { LogoSlide } from '../../core/state'

// Built-ins are bundled paths (resolved against BASE_URL for file:// builds);
// uploads are data: URLs used as-is.
export function logoSrc(src: string): string {
  return src.startsWith('data:') ? src : `${import.meta.env.BASE_URL}${src}`
}

export function LogoScene({ slide: logo, animate = false }: { slide: LogoSlide; animate?: boolean }) {
  const [failed, setFailed] = useState(false)
  // A failed load mustn't stick: switching logos starts fresh, and a broken one
  // keeps re-trying (a load can fail for a moment — a dev server restarting, a
  // slow disk — and the Blank screen would otherwise stay empty all night).
  useEffect(() => setFailed(false), [logo.src])
  useEffect(() => {
    if (!failed) return
    const id = setTimeout(() => setFailed(false), 3000)
    return () => clearTimeout(id)
  }, [failed])

  return (
    <div className={`scene-logo ${animate ? 'scene-logo--reveal' : ''}`}>
      {logo.src && !failed ? (
        <motion.img
          className="scene-logo__img"
          src={logoSrc(logo.src)}
          alt={logo.name}
          onError={() => setFailed(true)}
          // Slam in from large → settle, with a springy overshoot. Scale only —
          // the slide-stage handles the crossfade opacity. Silent = no animation.
          initial={animate ? { scale: 1.6 } : false}
          animate={{ scale: 1 }}
          transition={animate ? { type: 'spring', stiffness: 360, damping: 12, mass: 0.9 } : { duration: 0 }}
        />
      ) : (
        <div className="scene-logo__mark">{logo.name}</div>
      )}
      {logo.website && (
        <div className="scene-logo__site">
          {/* one span per character so a reveal can stagger them in */}
          {Array.from(logo.website).map((ch, i) => (
            <span key={i} style={{ ['--i' as string]: i }}>
              {ch}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
