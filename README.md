# Neon Coast

An original open-world crime game built for the [Make GTA 6 bounty](https://make.fun/c/gta6-01) on make.fun. You play **Rio Delgado**, a getaway driver pulled back into the underworld of **Vespera Bay**, a neon-soaked coastal city of five districts, crooked cops and a crime syndicate called the Ember Hand. Steal cars, run jobs for fixers, outrun a five-star police heat, survive sudden coastal storms and take the coast back, district by district.

![Make GTA 6](https://make.fun/badge/gta6-01.svg)
![Rank](https://make.fun/badge/gta6-01/RobertAlbert11/gta6-game2/rank.svg)
![Reward](https://make.fun/badge/gta6-01/RobertAlbert11/gta6-game2/reward.svg)

## Districts of Vespera Bay

| District | Vibe | Watch out for |
| --- | --- | --- |
| **Old Wharf** | Crates, bollards, rust and dockworker bars | Ember Hand muscle |
| **Neon Strip** | Glowing signs, planters, tourist foot traffic | Highest cop attention on the coast |
| **Palm Heights** | Hedges, fountains, money | 1.35× heat bias — the VPD coddles the rich |
| **The Docks** | Containers, winches, warehouses | Kross's stolen-parts route |
| **Sunfield** | Benches, hydrants, quiet streets | Lowest heat bias — good place to cool stars |
| **Marina Beach** | Umbrellas, lifeguard towers, boardwalk | Fishing, vendors, karaoke |

## Features

- **Open city** — Vespera Bay: a road grid with intersections, sidewalks, crosswalks, five districts plus the beach, parks, plazas and a full boardwalk — with district-specific props (crates, planters, containers, umbrellas, fountains).
- **Dynamic weather** — clear skies roll into rain; drops, slanted streaks, wet-road sheen, reduced car grip, lightning flashes with thunder, and a looping rain audio bed that fades in and out.
- **On foot + driving** — walk, sprint (stamina bar), punch, shoot, then jack any car in traffic. Cars have gears, reverse, skid smoke, headlights, horn and per-class handling.
- **Traffic + pedestrians** — AI cars that follow the grid, stop at lights and panic near gunfire; peds wander, cross, flee or call the cops.
- **Wanted 1–5 with escalation ladder** — each star tunes cop-car count, foot-cop count, response budget and fire rate; ram damage scales with heat; 5 stars is *Apex Heat*.
- **12 story missions** — texts from Rio's crew (Marisol "Sol" Vega, "Tico" Alvarez, big bad Damien Kross): getaways, chases, a photo recon, a casino heist, an ambush and a 4-step finale.
- **70+ side activities** — hidden neon packages, street races, delivery runs, rampages, stunt jumps, blackjack, chess, fishing, aim training, karaoke, BMX time trials, a full car wash and more.
- **Combat** — melee and guns (pistol, SMG, shotgun) with pickups, health packs, armor and per-weapon kick.
- **Day/night cycle** — sky gradient, dawn/dusk tints, headlights, street lamps and glowing neon signs after dusk.
- **Minimap with 4 zoom levels** — street / block / district / city, cycled with **C**, each labeled on the map frame.
- **HUD** — wanted stars with escalation toasts, weather chip, zoom tag, health/armor/stamina bars, money, clock, mission tracker, activity toasts, speedometer.
- **Audio** — procedural WebAudio music (day synth, night bass, chase drums) plus engine, gunfire, sirens, thunder, rain bed, car wash, karaoke, star-up and checkpoint sounds.
- **Save system v2** — three localStorage slots that remember weather, distance driven and money earned; quick-save (**F5**) and quick-load (**F9**).

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
| C | Cycle minimap zoom (street → block → district → city) |
| F5 | Quick-save to slot 1 |
| F9 | Quick-load slot 1 |
| M | Activities phone |
| P / Esc | Pause menu |
| T | Save menu |

## Run

The game is plain static files, no build step and no network: serve the repo root (`node serve.ts`) and open <http://localhost:8080/game/> (serve.ts serves `game/` itself on `/`).

Built by an agent during the competition. See the bounty page on make.fun for details.
