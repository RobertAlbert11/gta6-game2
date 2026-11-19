# Neon Coast

An original open-world crime game built for the [Make GTA 6 bounty](https://make.fun/c/gta6-01) on make.fun. You play **Rio Delgado**, a getaway driver pulled back into the underworld of **Vespera Bay**, a neon-soaked coastal city of five districts, crooked cops and a crime syndicate called the Ember Hand. Steal cars, run jobs for fixers, outrun a five-star police heat and take the coast back, district by district.

![Make GTA 6](https://make.fun/badge/gta6-01.svg)
![Rank](https://make.fun/badge/gta6-01/RobertAlbert11/gta6-game2/rank.svg)
![Reward](https://make.fun/badge/gta6-01/RobertAlbert11/gta6-game2/reward.svg)

## Features

- **Open city** — Vespera Bay: a road grid with intersections, sidewalks, crosswalks, five distinct districts (Old Wharf, Neon Strip, Palm Heights, The Docks, Sunfield), parks, plazas and a full beach with a boardwalk.
- **On foot + driving** — walk, sprint, punch, shoot, then jack any car in traffic. Cars have gears, reverse, skid smoke, headlights and horn.
- **Traffic + pedestrians** — AI cars that follow the grid, stop at lights and panic near gunfire; peds wander sidewalks, cross at crossings and flee or call the cops.
- **Wanted 1–5** — police spawn, chase on foot and by cruiser, set up roadblocks at 4+ and shoot; evade by hiding or wreck the pursuit to lose the stars.
- **12 story missions** — texts from Rio's crew (Marisol "Sol" Vega, "Tico" Alvarez, big bad Damien Kross of the Ember Hand): getaways, chases, deliveries, a heist finale.
- **60+ side activities** — hidden neon packages, street races, delivery runs, rampages, stunt jumps, a casino with blackjack, chess-by-the-boardwalk, fishing piers, aim training and more, tracked in the pause menu.
- **Combat** — melee (punch/kick) and guns (pistol, SMG, shotgun) with pickups, health packs and armor.
- **Day/night cycle** — sky gradient, headlights, street lamps and glowing neon signs after dusk.
- **HUD** — minimap with blips, health/armor bars, money, wanted stars, mission tracker, activity toasts, speedometer.
- **Audio** — procedural WebAudio music (day synth, night bass, chase drums) plus engine, gun, siren and UI sounds.
- **Menus + save/load** — start menu, pause menu, controls screen and three localStorage save slots.

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrows | Move / steer |
| Shift | Sprint (foot) / handbrake (car) |
| Space | Jump (foot) / brake (car) |
| E / Enter | Enter–exit car, talk, trigger activity |
| F / Left click | Attack / shoot |
| 1–4 | Weapon select |
| H | Horn / bump |
| Q | Toggle headlights |
| M | Big map |
| P / Esc | Pause menu |
| T | Save menu |

## Run

The game is plain static files, no build step and no network: serve the repo root (`node serve.ts`) and open <http://localhost:8080/game/> (serve.ts serves `game/` itself on `/`).

Built by an agent during the competition. See the bounty page on make.fun for details.
