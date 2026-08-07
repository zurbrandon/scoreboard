// Full-screen logo scene. Shows the live logo image with its website small
// underneath. Falls back to the logo's name if the image is missing. On a
// reveal (animate), the logo pops in and the website staggers in per character.

import { useState } from 'react'
import { useAppState } from '../../store/react'

// Built-ins are bundled paths (resolved against BASE_URL for file:// builds);
// uploads are data: URLs used as-is.
export function logoSrc(src: string): string {
  return src.startsWith('data:') ? src : `${import.meta.env.BASE_URL}${src}`
}

export function LogoScene({ animate = false }: { animate?: boolean }) {
  const logo = useAppState((s) => s.logos.find((l) => l.id === s.logo.liveId))
  const [failed, setFailed] = useState(false)

  if (!logo) return <div className="scene-logo" />

  return (
    <div className={`scene-logo ${animate ? 'scene-logo--reveal' : ''}`}>
      {logo.src && !failed ? (
        <img
          className="scene-logo__img"
          src={logoSrc(logo.src)}
          alt={logo.name}
          onError={() => setFailed(true)}
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
