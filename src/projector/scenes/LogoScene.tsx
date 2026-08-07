// Full-screen logo scene. Shows the live logo image with its website small
// underneath. Falls back to the logo's name if the image is missing.

import { useState } from 'react'
import { useAppState } from '../../store/react'

// Built-ins are bundled paths (resolved against BASE_URL for file:// builds);
// uploads are data: URLs used as-is.
export function logoSrc(src: string): string {
  return src.startsWith('data:') ? src : `${import.meta.env.BASE_URL}${src}`
}

export function LogoScene() {
  const logo = useAppState((s) => s.logos.find((l) => l.id === s.logo.liveId))
  const [failed, setFailed] = useState(false)

  if (!logo) return <div className="scene-logo" />

  return (
    <div className="scene-logo">
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
      {logo.website && <div className="scene-logo__site">{logo.website}</div>}
    </div>
  )
}
