# Neon Coast

An original open-world crime game built for the [Make GTA 6 bounty](https://make.fun/c/gta6-01) on make.fun. You play **Rio Delgado**, a getaway driver pulled back into the underworld of **Vespera Bay**, a neon-soaked coastal city of seven districts, crooked cops and a crime syndicate called the Ember Hand. Steal cars, run jobs for fixers, hail taxi fares, hunt bounties, outrun a five-star police heat, survive sudden coastal storms and take the coast back, district by district.

![Make GTA 6](https://make.fun/badge/gta6-01.svg)
![Rank](https://make.fun/badge/gta6-01/RobertAlbert11/gta6-game2/rank.svg)
![Reward](https://make.fun/badge/gta6-01/RobertAlbert11/gta6-game2/reward.svg)

## Districts of Vespera Bay

| District | Vibe | Watch out for |
| --- | --- | --- |
| **Old Wharf** | Crates, bollards, rust and dockworker bars | Ember Hand muscle |
| **Neon Strip** | Glowing signs, planters, tourist foot traffic | Highest cop attention on the coast |
| **Palm Heights** | Hedges, fountains, money | 1.35× heat bias — the VPD coddles the rich |
| **Industrial Zone** | Pipe stacks, spools, gantries, the Vulcan Foundry | Millhand brawls, fight club nights |
| **The Docks** | Containers, winches, warehouses | Kross's stolen-parts route |
| **Sunfield** | Benches, hydrants, quiet streets | Lowest heat bias — good place to cool stars |
| **Tech Quarter** | Server racks, drone parks, Hexon Dataworks | Coder crowds, corporate security |
| **Marina Beach** | Umbrellas, lifeguard towers, boardwalk | Fishing, vendors, karaoke |

## Features

- **Open city** — Vespera Bay: a road grid with intersections, sidewalks, crosswalks, seven districts plus the beach, parks, plazas and a full boardwalk — with district-specific props (crates, planters, containers, umbrellas, fountains, pipe stacks, server racks) and interior props (forges, server racks, chandeliers, assembly lines) peeking out of big buildings.
- **Dynamic weather** — clear skies roll into rain with an intensity level; two-pass rain streaks, splash rings, reflective puddle fields with neon shimmer, wet-road sheen, reduced car grip, lightning flashes with thunder, and a looping rain audio bed that fades in and out.
- **On foot + driving** — walk, sprint (stamina bar), punch, shoot, then jack any car in traffic. Seven vehicle classes — sedan, van, sports car, taxi, police cruiser, motorbike (fast, nimble, fragile) and cargo truck (slow, wide turns, heavy HP) — each with per-class handling and engine sounds.
- **Taxi fares** — hail a cab at the Strip Taxi Rank, deliver passengers for cash, and count your fares in the save stats.
- **Traffic + pedestrians** — AI cars that follow the grid, stop at lights and panic near gunfire; peds wander, cross, flee or call the cops.
- **Wanted 1–5 with escalation ladder** — each star tunes cop-car count, foot-cop count, response budget and fire rate; ram damage scales with heat; 5 stars is *Apex Heat*.
- **15 story missions** — texts from Rio's crew (Marisol "Sol" Vega, "Tico" Alvarez, big bad Damien Kross): getaways, chases, a photo recon, a casino heist, an ambush, a 4-step finale, the foundry ledger hunt, the Hexon drone blackout and a 4-step war of succession.
- **80+ side activities** — hidden neon packages, street races (including Terminal Velocity at the airport ramp), delivery runs, rampages, stunt jumps, blackjack, chess, fishing, aim training, karaoke, BMX time trials, a full car wash, taxi fares, bounty hunting, boost lists, mural tags, fight club, drone races, scrap runs, night-market snacks, postcard tours and more.
- **Combat** — melee and guns (pistol, SMG, shotgun) with pickups, health packs, armor and per-weapon kick.
- **Day/night cycle** — sky gradient, dawn/dusk tints, headlights, street lamps and glowing neon signs after dusk.
- **Minimap with 4 zoom levels** — street / block / district / city, cycled with **C**, each labeled on the map frame with a live weather indicator (sun/moon/rain %).
- **HUD** — wanted stars with escalation toasts, weather chip with rain intensity, zoom tag, health/armor/stamina bars, animated money counter (green/red flash on change), activity counter (done/total), clock, mission tracker, activity toasts, speedometer.
- **Radio** — two procedural stations (NEON FM synthwave + BAY WAVES surf) toggled with **R**, station-flipped with **R** while driving; plus engine pitch flutter per vehicle class and a rain ambience layer.
- **Audio** — procedural WebAudio music (day synth, night bass, chase drums) plus engine, gunfire, sirens, thunder, rain bed, car wash, karaoke, star-up and checkpoint sounds.
- **Save system v2** — three localStorage slots that remember weather (with intensity), distance driven, money earned and full activity completion stats; quick-save (**F5**) and quick-load (**F9**).

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
| R | Radio toggle / flip station while driving |
| F5 | Quick-save to slot 1 |
| F9 | Quick-load slot 1 |
| M | Activities phone |
| P / Esc | Pause menu |
| T | Save menu |

## Run

The game is plain static files, no build step and no network: serve the repo root (`node serve.ts`) and open <http://localhost:8080/game/> (serve.ts serves `game/` itself on `/`).

Built by an agent during the competition. See the bounty page on make.fun for details.
