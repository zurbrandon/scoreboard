// Full-screen scene for logos / text / slideshow. Shows a logo image from
// public/logos/ when `file` is given, falling back to the text label if the
// image is missing (text/slideshow have no art yet, so they stay text).

import { useState } from 'react'

export function LogoScene({
  label,
  accent,
  file,
}: {
  label: string
  accent: string
  file?: string
}) {
  const [failed, setFailed] = useState(false)
  const showImage = file && !failed

  return (
    <div className="scene-logo" style={{ ['--accent' as string]: accent }}>
      {showImage ? (
        <img
          className="scene-logo__img"
          src={`${import.meta.env.BASE_URL}logos/${file}`}
          alt={label}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="scene-logo__mark">{label}</div>
      )}
    </div>
  )
}
