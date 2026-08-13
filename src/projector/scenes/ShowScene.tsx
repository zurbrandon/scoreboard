// The scripted show-intro beats: full-screen themed cards the operator flips
// through to open a match (welcome the ref, the players, each team, the captains,
// or settle the room to black). Team beats pull the live team names so "the Blue
// team" reads as whatever the teams are actually called.
//
// Animation follows the projector rule: transform/opacity only, never per-frame
// blur — the ref stripes are one wide striped element sliding on translateX.

import type { ShowSlide, TeamId } from '../../core/state'

function rosterLines(roster: string): string[] {
  return roster
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

// A team welcome / captain card: solid team color, an eyebrow label, the team
// name, and either a roster or a single captain name.
function TeamCard({
  side,
  eyebrow,
  title,
  roster,
  name,
}: {
  side: TeamId
  eyebrow: string
  title: string
  roster?: string[]
  name?: string
}) {
  return (
    <div className={`show show--team show--${side}`}>
      <div className="show__eyebrow">{eyebrow}</div>
      <div className="show__title">{title}</div>
      {roster && roster.length > 0 && (
        <ul className="show__roster">
          {roster.map((n, i) => (
            <li key={i} className="show__roster-item" style={{ ['--i' as string]: i }}>
              {n}
            </li>
          ))}
        </ul>
      )}
      {name && <div className="show__name">{name}</div>}
    </div>
  )
}

// A dual split card (players / captains): red on one side, blue on the other,
// with a centered title band.
function DualCard({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="show show--dual">
      <div className="show__half show__half--blue" />
      <div className="show__half show__half--red" />
      <div className="show__dual-copy">
        <div className="show__eyebrow">{eyebrow}</div>
        <div className="show__title">{title}</div>
      </div>
    </div>
  )
}

export function ShowScene({
  slide,
  teams,
}: {
  slide: ShowSlide
  teams: Record<TeamId, { name: string }>
}) {
  const blue = teams.blue.name || 'Blue'
  const red = teams.red.name || 'Red'

  switch (slide.beat) {
    case 'ref':
      return (
        <div className="show show--ref">
          <div className="show__stripes" aria-hidden />
          <div className="show__ref-copy">
            <div className="show__eyebrow">Please welcome your referee</div>
            {slide.name && <div className="show__name show__name--ref">{slide.name}</div>}
          </div>
        </div>
      )
    case 'players':
      return <DualCard eyebrow="Comedy sports presents" title="Welcome your players!" />
    case 'captains':
      return <DualCard eyebrow="Take the field" title="Team captains" />
    case 'team-blue':
      return <TeamCard side="blue" eyebrow="Welcome" title={blue} roster={rosterLines(slide.roster)} />
    case 'team-red':
      return <TeamCard side="red" eyebrow="Welcome" title={red} roster={rosterLines(slide.roster)} />
    case 'captain-blue':
      return <TeamCard side="blue" eyebrow={`${blue} captain`} title={slide.name || 'Captain'} />
    case 'captain-red':
      return <TeamCard side="red" eyebrow={`${red} captain`} title={slide.name || 'Captain'} />
    case 'blackout':
    default:
      return <div className="show show--blackout" />
  }
}
