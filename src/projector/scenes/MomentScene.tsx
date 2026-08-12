// Full-screen run-out / run-in moment: a giant phrase that slams in and holds
// (readable, not a blur), or a full-bleed GIF. CSS transform/opacity only — no
// per-frame blur (projector perf rule), and CSS keyframes keep running even when
// the window is hidden (unlike rAF). Keyed on momentNonce upstream so a repeat
// trigger replays the slam.

import type { Moment } from '../../core/state'

export function MomentScene({ moment }: { moment: Moment }) {
  if (moment.visual.type === 'image') {
    return (
      <div className={`moment moment--${moment.kind} moment--image`}>
        <img className="moment__img" src={moment.visual.src} alt="" />
      </div>
    )
  }
  return (
    <div className={`moment moment--${moment.kind}`}>
      <div className="moment__solo">{moment.visual.phrase}</div>
    </div>
  )
}
