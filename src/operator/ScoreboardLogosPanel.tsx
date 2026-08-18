// Settings → Visuals: swap the scoreboard's two corner logos. Pick a built-in
// preset or upload your own; the choice lives in app state so the projector
// updates live. Defaults are ComedySportz (left) + Seattle Comedy Theater (right).

import { useRef } from 'react'
import { useAppState, useDispatch } from '../store/react'
import { LOGO_LIBRARY } from '../core/logos'
import { defaultScoreboardLogos } from '../core/state'
import { logoImgSrc, fileToLogoSrc } from './logoAssets'

const PRESETS = LOGO_LIBRARY.map((l) => ({ name: l.name, src: `logos/${l.file}` }))

function LogoSlot({ side, label }: { side: 'left' | 'right'; label: string }) {
  const dispatch = useDispatch()
  const src = useAppState((s) => s.scoreboardLogos[side])
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (v: string) => dispatch({ type: 'scoreboard.setLogo', side, src: v })
  return (
    <div className="logo-slot">
      <div className="logo-slot__head">
        <span className="logo-slot__label">{label}</span>
        <div className="logo-slot__preview">
          <img src={logoImgSrc(src)} alt="" />
        </div>
      </div>
      <div className="logo-slot__choices">
        {PRESETS.map((p) => (
          <button
            key={p.src}
            className={`logo-chip ${src === p.src ? 'logo-chip--active' : ''}`}
            title={p.name}
            onClick={() => set(p.src)}
          >
            <img src={logoImgSrc(p.src)} alt={p.name} />
          </button>
        ))}
        <button className="pill" onClick={() => fileRef.current?.click()}>
          Upload…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) {
              try {
                set(await fileToLogoSrc(f))
              } catch (err) {
                console.warn('[logo] upload failed:', err)
              }
            }
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

export function ScoreboardLogosPanel() {
  const dispatch = useDispatch()
  const reset = () => {
    const d = defaultScoreboardLogos()
    dispatch({ type: 'scoreboard.setLogo', side: 'left', src: d.left })
    dispatch({ type: 'scoreboard.setLogo', side: 'right', src: d.right })
  }
  return (
    <div className="extra logo-slots">
      <LogoSlot side="left" label="Top-left" />
      <LogoSlot side="right" label="Top-right" />
      <button className="pot__clear logo-slots__reset" onClick={reset}>
        Reset to defaults
      </button>
    </div>
  )
}
