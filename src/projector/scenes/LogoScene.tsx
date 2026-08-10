// Full-screen logo scene. Shows the live logo image with its website small
// underneath. Falls back to the logo's name if the image is missing. On a
// reveal (animate), the logo slams in (Motion spring) and the website staggers
// in per character.

import { useState } from 'react'
import { motion } from 'motion/react'
import type { LogoSlide } from '../../core/state'

// Built-ins are bundled paths (resolved against BASE_URL for file:// builds);
// uploads are data: URLs used as-is.
export function logoSrc(src: string): string {
  return src.startsWith('data:') ? src : `${import.meta.env.BASE_URL}${src}`
}

export function LogoScene({ slide: logo, animate = false }: { slide: LogoSlide; animate?: boolean }) {
  const [failed, setFailed] = useState(false)

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
