/**
 * WORLD ORDER — Critic-APPROVED locked image prompts (Style Bible v1.0).
 * Source of truth for PROMPTS.LOCKED.md and placeholders:prompts.
 */

export const MASTER_PREFIX =
  "WORLD ORDER satirical political TCG illustration, editorial cartoon caricature, bold black ink outlines, flat cel-shaded color blocks, high contrast graphic satire, newspaper collage texture, exaggerated silhouette readable at thumbnail distance, hand-painted gouache-ink hybrid look, sharp readable shapes, no photorealism, no 3D CGI, parody fictional leaders only";

export const PORTRAIT_TECH =
  "512×768 2:3 RGBA transparent cutout for Three.js billboard, alphaTest-safe hard silhouette edges, full-body or strong 3/4 figure fills frame, isolated character only, no ground, no floor shadow, no backdrop, no scenery, no environment props behind subject";

export const CARD_TECH =
  "360×540 opaque art panel filling the entire frame, pure scene illustration only, NO card frame, NO chrome, NO UI, NO nameplate, NO cost gem, NO rarity banner, NO readable text; rarity expressed only as lighting FX intensity and color temperature within the scene";

export const MASTER_NEGATIVE =
  "photorealistic, real person likeness, celebrity face, politician photo, 3d render, cgi, unreal engine, blender, octane, anime, manga, chibi, kawaii, cute style, soft airbrush, blurry, low contrast, muddy colors, watercolor wash, sketch only, unfinished, watermark, signature, logo, brand marks, readable text, letters, numbers, typography, UI chrome, card frame, nameplate, cost gem, rarity banner, health bar, speech bubble, gore, blood, nsfw, nudity, mutilation, extra limbs, duplicate heads, cropped head, cut-off feet, busy noise background behind cutout subject, pure white studio backdrop, gradient gray void, stock photo";

export type FactionId = "donald-rumpf" | "vladimir-pu" | "jin-shi" | "vlado-zelenko";

export const FACTION_PHRASE: Record<FactionId, string> = {
  "donald-rumpf":
    "US navy #1A3A6B and stripe-red #B22234 with gold #D4AF37 accents",
  "vladimir-pu":
    "Russia cold-red #CC0000 on bunker-black with sparse gold #D4AF37",
  "jin-shi": "China crimson #DE2910 and industrial gold #FFDE00",
  "vlado-zelenko":
    "Ukraine blue #005BBB and gold #FFD500 under harsh spotlight",
};

export const FACTION_PALETTE: Record<
  FactionId,
  { primary: string; secondary: string; accent: string; dark: string }
> = {
  "donald-rumpf": {
    primary: "#1A3A6B",
    secondary: "#B22234",
    accent: "#D4AF37",
    dark: "#0a1628",
  },
  "vladimir-pu": {
    primary: "#CC0000",
    secondary: "#1A0000",
    accent: "#D4AF37",
    dark: "#0a0000",
  },
  "jin-shi": {
    primary: "#DE2910",
    secondary: "#FFDE00",
    accent: "#FFDE00",
    dark: "#1a0500",
  },
  "vlado-zelenko": {
    primary: "#005BBB",
    secondary: "#FFD500",
    accent: "#FFD500",
    dark: "#001a33",
  },
};

export type LockedAssetKind = "portrait" | "card" | "shared" | "arena-layer";

export interface LockedAsset {
  id: string;
  file: string;
  kind: LockedAssetKind;
  width: number;
  height: number;
  faction?: FactionId;
  rarity?: "common" | "rare" | "epic" | "legendary";
  /** Unique visual core (no master prefix / tech / faction). */
  visualCore: string;
  alpha: boolean;
}

function portrait(
  characterId: FactionId,
  form: 1 | 2 | 3,
  visualCore: string,
): LockedAsset {
  return {
    id: `${characterId}-form${form}`,
    file: `characters/${characterId}-form${form}.webp`,
    kind: "portrait",
    width: 512,
    height: 768,
    faction: characterId,
    visualCore,
    alpha: true,
  };
}

function card(
  id: string,
  faction: FactionId,
  rarity: LockedAsset["rarity"],
  visualCore: string,
): LockedAsset {
  return {
    id,
    file: `cards/${id}.webp`,
    kind: "card",
    width: 360,
    height: 540,
    faction,
    rarity,
    visualCore,
    alpha: false,
  };
}

export function buildPrompt(asset: LockedAsset): string {
  const parts = [MASTER_PREFIX];
  if (asset.kind === "portrait") parts.push(PORTRAIT_TECH);
  else if (asset.kind === "card") parts.push(CARD_TECH);
  parts.push(asset.visualCore);
  if (asset.faction) parts.push(FACTION_PHRASE[asset.faction] + ".");
  return parts.join(" ");
}

export const PORTRAITS: LockedAsset[] = [
  portrait(
    "donald-rumpf",
    1,
    'Form 1 "Candidate": fictional parody US campaign boss Donald Rumpf, NOT a real person—oversized blond swept hair tuft, orange-tan cartoon complexion, tiny glare eyes, huge navy suit, absurdly long stripe-red necktie, gold cufflinks, one fist raised and one hand gripping a blank microphone; confident early-career swagger filling the frame.',
  ),
  portrait(
    "donald-rumpf",
    2,
    'Form 2 "President": same fictional Donald Rumpf caricature language amplified—broader chest, sharper glare, navy power suit with gold-trimmed stripe-red necktie, one hand pointing forward, other clutching a blank executive folder marked only by an abstract gold eagle emblem (no letters); escalated authority pose.',
  ),
  portrait(
    "donald-rumpf",
    3,
    'Form 3 "MAGA Phoenix": mythic escalation of the same parody figure—blank oversized stripe-red baseball-cap relic crowning the head, navy suit half-consumed by phoenix wings of gold and crimson flame-feathers with suit-to-flame scale transition along the lapels, necktie becoming a fiery ribbon talon, gold eagle brands burning on both cufflinks, blank microphone morphing into a clawed talon in one fist, campaign-ash orbit sparks and ember rings hugging the hard cutout edge, arms spread in rebirth triumph, one dense attached-prop silhouette.',
  ),
  portrait(
    "vladimir-pu",
    1,
    'Form 1 "Premier": parody fictional Russian strongman Vladimir Pu—short stocky caricature, oversized rectangular head, tiny cold pinprick eyes, thin smirk, pale porcelain face, black suit, oversized cold-red necktie like a frozen ribbon, hands clasped behind back, subtle judo-ready stance, calm early-power composure.',
  ),
  portrait(
    "vladimir-pu",
    2,
    'Form 2 "Leader": same parody identity escalated—broader shoulders, stiff bunker-black greatcoat with cold-red lining, blank gold medal discs, clenched fists, colder stare, jaw set like a hatch, cornered authoritarian intensity.',
  ),
  portrait(
    "vladimir-pu",
    3,
    'Form 3 "Bear": mythic humanoid bear-hybrid cutout—massive cartoon bear torso fused to the same blank-eyed parody face, bunker-hatch crown bolted to the skull, frozen medal constellation across the chest, oil-pipe vertebrae ridges down the spine, padlock chain belt cinching the gut, cold-red sash, steel clawed gauntlets with sparse gold rivets, snow-ember sparks hugging the hard cutout edge, towering absolute-authority pose, one dense attached-prop silhouette.',
  ),
  portrait(
    "jin-shi",
    1,
    'Form 1 "Secretary": lean calm parody Chinese bureaucrat Jin Shi, fictional caricature not a real person, plain charcoal suit, tiny crimson lapel pin, neat side-part hair, soft unreadable smile, thick blank binder chained to wrist like a leash of plans, miniature conveyor-belt cufflink and pocket abacus as attached props only, restrained early-career silhouette.',
  ),
  portrait(
    "jin-shi",
    2,
    'Form 2 "Chairman": broader heavier parody leader Jin Shi, sharper eyes, thicker suit shoulders, crimson sash with industrial-gold geometric lattice across chest, one hand in slow ceremonial wave, other gripping a giant red seal-stamp shield, stylized crimson dragon embroidery climbing the sleeve like industrial wiring, escalated power silhouette.',
  ),
  portrait(
    "jin-shi",
    3,
    'Form 3 "Eternal Dragon": maximum grotesque mythic escalation, humanoid emperor-bureaucrat Jin Shi fused with a crimson dragon mantle, dragon-shoulder pauldrons of steel and silk, elongated jaw smirk, glowing industrial-gold eyes, mandarin collar exploding into dragon scales, coiled miniature factory smokestacks rising from the dragon cape like spines, looping hourglass chains wrapped around wrists, propaganda-poster grandeur, duplicated coin-orbs orbiting the figure as self-replication motif, one dense attached-prop silhouette.',
  ),
  portrait(
    "vlado-zelenko",
    1,
    'Form 1 "Comedian": satirical parody Ukrainian wartime leader caricature Vlado Zelenko, fictional not a real person—short athletic build, oversized expressive eyes, stubbled jaw, olive-green stage t-shirt with blue-gold trim, handheld comedy microphone as asymmetric prop, playful three-quarter stance, warm spotlight cone painted on the figure only, restrained early-career silhouette.',
  ),
  portrait(
    "vlado-zelenko",
    2,
    'Form 2 "President": same Vlado Zelenko caricature language intensified—olive tactical tee under light vest, clenched jaw, camera-flash orbs clinging to shoulders as worn props, one fist forward, media-frontline hybrid silhouette, stronger contrast, bigger flashlight/mic cluster breaking the shoulder line.',
  ),
  portrait(
    "vlado-zelenko",
    3,
    'Form 3 "AFU Legend": maximum grotesque escalation of the same caricature—stylized tryzub-shaped steel pauldrons with sandbag plating layered beneath, torn blue-gold flag-fabric cape as asymmetric flare, olive tee tearing into flag-plate scales across the ribs, mic-cluster spine rising behind the shoulders, flash-orb satellites orbiting the fists, tryzub halo shards behind the head, heroic wide stance, radiant defiance aura painted on the figure only, one dense attached-prop hard silhouette.',
  ),
];

export const DONALD_CARDS: LockedAsset[] = [
  card("dr-tweet", "donald-rumpf", "common", "Visual core: giant cartoon smartphone exploding at center, jagged gold lightning and navy tweet-bubbles blasting from a cracked screen, blank bird silhouettes scattering like shrapnel through newspaper collage scraps; common-tier cool flash lighting."),
  card("dr-wall", "donald-rumpf", "common", "Visual core: towering brick barrier rising diagonally, thick cartoon mortar lines, a huge construction-gloved hand planting a final gold-edged brick against a navy sky with gold sunburst; common-tier hard daylight contrast."),
  card("dr-tariff", "donald-rumpf", "common", "Visual core: colossal golden customs stamp slamming onto stacked shipping containers, crates cracking, coins bursting in shockwaves, stripe-red wax-seal rings (graphic blobs only); common-tier warm impact flare."),
  card("dr-rally", "donald-rumpf", "common", "Visual core: raised stage megaphone blasting concentric gold sound rings over a sea of blank stripe-red baseball caps and waving navy banners, spotlight beams cutting confetti and newspaper scraps; crowd as abstract silhouettes only; common-tier stage-light warmth."),
  card("dr-deal", "donald-rumpf", "common", "Visual core: two enormous cartoon hands locked in a crushing golden handshake above a tilted balance scale, blank contract scroll crumpling between palms, coins tipping one pan and navy briefcases the other; common-tier polished gold specular kick."),
  card("dr-fake-news", "donald-rumpf", "common", "Visual core: wall of shattered TV screens and spinning blank newspaper pages, each screen crossed by a bold stripe-red prohibition X (graphic mark only), static sparks and ink blots flying around a cracking navy truth-shield; common-tier cold CRT glare."),
  card("dr-ban", "donald-rumpf", "rare", "Visual core: gigantic stripe-red rubber stamp descending onto a passport booklet and airplane icon, leaving a glowing prohibition circle, abstract gold eagle-seal flare, navy impact shockwave freezing documents mid-air; rare-tier hotter stamp glow."),
  card("dr-sanctions", "donald-rumpf", "rare", "Visual core: heavy iron padlock chaining an oil barrel to a frozen bank vault door, gold coins trapped in ice crystals, stripe-red wax blobs as abstract seals, navy frost aura and snapped trade arrows; rare-tier icy blue-gold lighting tension."),
  card("dr-media", "donald-rumpf", "rare", "Visual core: vertical cyclone of cameras, boom mics, satellite dishes, and flashbulbs swirling into a media hurricane, gold lightning stitching lenses, navy storm clouds of newspaper collage, one bright spotlight piercing the eye; rare-tier stroboscopic flash intensity."),
  card("dr-golf", "donald-rumpf", "rare", "Visual core: gleaming gold golf club mid-swing on a surreal manicured green, ball replaced by a glowing vitality orb trailing soft navy sparkle rings, palm silhouettes and fairway curves; rare-tier sunny leisure glow with gentle gold bloom."),
  card("dr-executive", "donald-rumpf", "epic", "Visual core: giant fountain pen signing a blank decree that transforms mid-stroke into a gold lightning blade slicing a shield, wax seal exploding into sparks, navy desk silhouette and eagle-wing paper edges; epic-tier hot white-gold slash lighting."),
  card("dr-trade-war", "donald-rumpf", "epic", "Visual core: two cartoon cargo ships facing off on stormy navy water, firing gold coin-cannonballs and tariff crates at each other, shattered containers raining between them, blank stripe-red warning flags; epic-tier fiery orange muzzle flashes against cold sea."),
  card("dr-veto", "donald-rumpf", "epic", "Visual core: massive gavel slamming down and erupting a translucent navy force-field dome that deflects a flying blank legislation scroll, gold impact rings, rejected papers bouncing as confetti; epic-tier cool protective bloom."),
  card("dr-fire", "donald-rumpf", "epic", "Visual core: oversized pointing cartoon finger launching a tiny suited stick-figure out of a boardroom on a rocket trail of flying papers and a blank pink slip, gold explosion burst behind the ejection, navy office doorway silhouette; epic-tier hot ejection flare."),
  card("dr-maga-hat", "donald-rumpf", "rare", "Visual core: gigantic blank stripe-red baseball cap floating as a power relic, radiating gold strength aura rings and navy lightning, tiny star sparks, blank campaign flags whipping around it; rare-tier saturated crimson-gold halo."),
  card("dr-twitter-ban", "donald-rumpf", "legendary", "Visual core: blue cartoon bird icon locked in an iron cage while a smashed smartphone rains glass and muted blank speech ovals, giant stripe-red prohibition stamp shadow falling across the cage, gold silencing shockwave; legendary-tier extreme high-key flash and deep navy shadow."),
  card("dr-wall-2", "donald-rumpf", "rare", "Visual core: colossal double-layered border wall spanning a desert canyon, twin ramparts with gold-lit watchtowers and cartoon battlements, navy night sky, searchlight cones forming a defensive halo; rare-tier cold searchlight beams with warm gold tower lamps."),
  card("dr-nuclear", "donald-rumpf", "legendary", "Visual core: huge glossy stripe-red button under a descending cartoon hand, mid-press unleashing a stylized gold-and-navy mushroom cloud of pure graphic blast-light (no bodies, no destruction gore), abstract hazard triangles only; legendary-tier blinding white-gold core bloom and deep navy rim light."),
  card("dr-maga-phoenix", "donald-rumpf", "legendary", "Visual core: radiant phoenix of gold and crimson fire rising from campaign ashes and torn newspaper collage, wings spread full-vertical, blank stripe-red baseball-cap silhouette crowning its head, navy vitality orbs orbiting the rebirth; legendary-tier maximum fire-gold intensity and cool navy rim."),
  card("dr-impeach", "donald-rumpf", "epic", "Visual core: cracked judge's gavel and torn blank legal scroll falling through a spiral of repeating circular stamp marks (graphic circles only), the scroll splitting a cartoon crystal gauge in half as ironic again satire, gold courtroom pillars tilting, navy papers raining; epic-tier harsh courtroom spotlight and cold shadow."),
];

export const VLADIMIR_CARDS: LockedAsset[] = [
  card("vp-hybrid", "vladimir-pu", "common", "Hybrid War scene: a chessboard battlefield where tanks, TV cameras, gas pipes, and blank megaphone fog attack together from one crimson bear-shadow; half the board is newsprint collage, half is snow and steel. Common rarity: flat bunker-lamp lighting, cool steel temperature."),
  card("vp-gas", "vladimir-pu", "common", "Gas Lever scene: a giant red valve-handle shaped like a bear paw crushing a glowing pipe while distant city radiators freeze into ice cubes; warm valve glow versus blue frost. Common rarity: muted contrast."),
  card("vp-judo", "vladimir-pu", "common", "Judo Throw scene: anonymous caricature judoka mid-flip on a mat patterned like a world map; thrower in black gi with cold-red belt, opponent spinning upside-down through sharp motion streaks. Common rarity: hard side-light."),
  card("vp-bunker", "vladimir-pu", "common", "Bunker scene: a massive underground concrete hatch slamming shut into a steel shield-dome; nested corridors, cold-red emergency lamps, a tiny desk lamp glowing safe inside. Common rarity: dim emergency-lamp temperature."),
  card("vp-disinfo", "vladimir-pu", "common", "Disinformation scene: a hall of cracked mirrors reflecting conflicting blank newsprint panels; ink fog pouring from megaphones; a bullseye dissolving into TV static snow while rumor-arrows miss. Common rarity: cool foggy light."),
  card("vp-siloviki", "vladimir-pu", "common", "Siloviki scene: a wall of identical anonymous enforcer caricatures in black coats and peaked caps, shoulder-to-shoulder like iron fence posts, fists and riot shields forward, blank cold-red armbands. Common rarity: harsh frontal bunker light."),
  card("vp-pipeline", "vladimir-pu", "rare", "Pipeline scene: a colossal steel serpent-pipe crossing snow, pumping glowing amber fuel that spins turbines and warms a cracked industrial heart-gauge. Rare rarity: stronger gold rim-light on pipe seams."),
  card("vp-oligarch", "vladimir-pu", "rare", "A bloated faceless tycoon in a fur-collared coat magnetically yanks a glowing blank vault plaque from a rival's grasp into a golden suitcase vault. Rare rarity: richer gold suitcase blaze."),
  card("vp-nuke-hint", "vladimir-pu", "rare", "Nuclear Hint scene: an open steel briefcase casting a cartoon mushroom-cloud shadow as warning only, while a giant cold-red pause-hand blocks a falling bomb icon — threat without detonation. Rare rarity: icy steel briefcase glow."),
  card("vp-tass", "vladimir-pu", "rare", "Official Version scene: a giant rubber stamp slamming conflicting newspaper collage panels flat into one neat blank headline block as shredded rival posters explode outward. Rare rarity: hard flashbulb white-gold strike light."),
  card("vp-bear", "vladimir-pu", "epic", "Bear Grip scene: a colossal cartoon bear hug crushing a steel globe between massive paws, rivets popping, crimson pressure rings radiating. Epic rarity: hot cold-red flare rings, dramatic side-light."),
  card("vp-nerve", "vladimir-pu", "epic", "Nerve Agent scene: a gloved hand tips a tiny glass vial releasing sickly green mist that forms a dripping hourglass over a collapsing silhouette target — sterile lab dread, no gore. Epic rarity: toxic green vs cold-red hazard stripes."),
  card("vp-fortress", "vladimir-pu", "epic", "Fortress scene: an absurdly overbuilt onion-dome citadel of stacked walls with blank geometric star spikes, wrapped in hexagonal steel panes glowing ice-blue around a warm keep-heart light. Epic rarity: intense ice-blue shield glow."),
  card("vp-special-op", "vladimir-pu", "epic", "Special Operation scene: ghostly silhouette commandos leaping through a ripped map curtain of blank stamps while a crimson slash bypasses shattered shield plates. Epic rarity: hot cold-red slash flare."),
  card("vp-fsb", "vladimir-pu", "rare", "A black rotary phone morphing into a radar dish freezes oversized blank dossier slabs mid-air with red concentric signal rings while smaller scraps slip through. Rare rarity: colder radar-cyan rim vs cold-red rings."),
  card("vp-sputnik", "vladimir-pu", "rare", "Sputnik scene: a cartoon satellite with antenna whiskers beams a green-red medical-cross light onto a cracked shield below; orbit trails like stylized syringe streaks, symbolic not gory. Rare rarity: hopeful cool-green beam."),
  card("vp-cyber", "vladimir-pu", "epic", "A bear-claw cursor smashes a glass screen into binary confetti of blank squares as cables web a city skyline in crimson glitch shards. Epic rarity: electric cold-red glitch flares, harsh cyan-steel sparks."),
  card("vp-sovereign", "vladimir-pu", "legendary", "Sovereign Nuke scene: a throne carved from a missile-silo hatch; a stylized atom emblem erupting into a geometric mushroom of pure crimson light that punches through layered paper-thin shields. Legendary rarity: maximum gold and cold-red temperature extremes."),
  card("vp-eternal", "vladimir-pu", "legendary", "An endless corridor of identical blank-portrait doors and a crown of welded clocks circling a steel heart-shield that never cracks. Legendary rarity: eternal gold clock-halo blaze, deep cold-red door recesses."),
  card("vp-bearmode", "vladimir-pu", "legendary", "A bear-shaped industrial switch flips a crimson gravity field that swells rival blank totems into heavy padlocked ice weights sinking into tar-snow. Legendary rarity: crushing cold-red gravity glow, molten-gold switch contacts."),
];

export const JIN_CARDS: LockedAsset[] = [
  card("js-belt", "jin-shi", "common", "Common flat lighting: a gigantic crimson silk belt cinching a cartoon globe like a luggage strap, the belt a living conveyor packed with identical shipping containers and tiny factories sprouting along its length, industrial-gold dragon-head buckle locking continents together, top-down editorial composition."),
  card("js-road", "jin-shi", "common", "Common flat lighting: an endless industrial-gold highway unfurling from a crimson dragon's mouth across oceans and deserts, asphalt paved with stacked blank coins, freight trains and cargo ships racing in identical lanes toward a vanishing point that rebuilds itself forever."),
  card("js-factory", "jin-shi", "common", "Common flat industrial lighting: a towering megafactory with crimson-and-gold crayon smokestacks, conveyor belts cloning the same smiling blank toy endlessly, newspaper-collage walls, a tiny stamp-robot foreman directing the flow, dense vertical self-replication satire."),
  card("js-censor", "jin-shi", "common", "Common stark lighting: a colossal firewall of blacked-out blank newspaper bricks and circuit-board masonry, giant rubber censor stamps slamming shut like portcullis gates, paper birds crumpling into wads on impact, faint crimson digital lattice behind the wall."),
  card("js-panda", "jin-shi", "common", "Common warm propaganda-poster lighting: an oversized satirical panda mascot offering a bamboo bouquet while secretly pressing a gold contract seal onto a rival sleeve with the other paw, crimson gift ribbon wrapping the scene like soft padding, charm-as-shield joke."),
  card("js-five-year", "jin-shi", "common", "Common flat machine lighting: five gigantic interlocking brass-and-crimson gears with blank calendar-block teeth, each gear birthing a new identical blank rectangular panel onto a conveyor, a metronome-dragon pendulum swinging above counting eras, long-horizon planning absurdity."),
  card("js-yuan", "jin-shi", "rare", "Rare cool blue rim light, clear motion lines: a whirlpool of oversized blank industrial-gold coins with abstract geometric centers vacuuming glowing power-orbs from weaker foreign currency balloons, a crimson dragon-shaped exchange graph thrashing like a living rollercoaster."),
  card("js-social", "jin-shi", "rare", "Rare cool blue rim light on a giant scoreboard-eye in the sky projecting green-check and red-cross spotlights onto tiny citizen silhouettes on a chessboard plaza, some lifted on gold pedestals while others sink into gray fog pits, surveillance cameras blooming like flowers, abstract glyphs only on the board."),
  card("js-tech", "jin-shi", "rare", "Rare cool blue rim light and sharp motion streaks: a trench-coat spy-panda feeds blank glowing blueprints into a dragon-headed scanner that spit out identical twin copies, stolen circuit boards folding into origami dragons mid-air over a glass-factory night collage."),
  card("js-army", "jin-shi", "rare", "Rare cool blue rim light on endless identical toy-soldier columns marching in pixel-grid rows, oversized parade tanks shaped like folded red envelopes, a crimson dragon banner unfurling like a runway, synchronized boots kicking up industrial-gold dust, forward-thrust spectacle."),
  card("js-xi-thought", "jin-shi", "rare", "Rare cool blue rim around a glowing blank crimson hardcover floating like a holy battery, radiating industrial-gold idea-orbs that plug into factory sockets and idle machines, tiny identical heads nodding in unison as if charging from one shared thought, doctrine-without-words satire."),
  card("js-tariff-back", "jin-shi", "rare", "Rare cool blue rim and slapstick rebound arcs: a rubbery crimson customs wall of giant stamp-paddles bouncing incoming cargo crates back at the sender like a pinball machine, industrial-gold duty seals ricocheting mid-air, trade-war reflection shield joke."),
  card("js-dragon", "jin-shi", "epic", "Epic violet aura veins, surreal scale jump, denser collage, dramatic backlight: a colossal crimson industrial dragon erupting from a skyline of identical factories, smoke becoming scales, conveyor belts becoming tendons, industrial-gold floodlight eyes opening, roar shaking newspaper-collage clouds, vertical rising composition."),
  card("js-bri", "jin-shi", "epic", "Epic violet backlight and denser collage: the globe wrapped by a crimson silk belt and an industrial-gold highway ribbon at once, ports and rail hubs sprouting wherever the ribbons touch, green infrastructure sprouts knitting cracked earth while blank coin-rain lifts upward into the network, soft-power restoration spectacle."),
  card("js-propaganda", "jin-shi", "epic", "Epic violet studio glow and denser repeating collage: a canyon of giant blank television screens all broadcasting the same smiling cartoon face in perfect unison, speaker horns blasting visible sound-waves that slow rival paper airplanes mid-flight, crimson floodlights and abstract industrial-gold starbursts, media-saturation tempo sabotage."),
  card("js-censure", "jin-shi", "epic", "Epic violet impact backlight: a gigantic ceremonial red seal slamming down on a rival blank dossier silhouette, crushing it into confetti while stern identical committee silhouettes nod in a semi-circle, an industrial-gold self-purification brush sweeping scraps into a trash-dragon mouth."),
  card("js-emperor", "jin-shi", "legendary", "Legendary hot orange-gold radiance, monumental contrast: a parody emperor-bureaucrat enthroned on a dragon-shaped factory throne, mandate halo of interlocking gears pouring luminous industrial-gold light and coin-orbs into cracked earth below, heavenly mandate as industrial refill, no real-person likeness."),
  card("js-eternal-rule", "jin-shi", "legendary", "Legendary hot orange-gold radiance: an infinite Möbius hourglass fused with a giant official seal, sand made of tiny identical leader silhouettes looping forever, crimson chains locking rival power-orbs so they cannot refill, permanence-as-weapon satire, monumental central symbol."),
  card("js-century", "jin-shi", "legendary", "Legendary hot orange-gold dawn radiance: broken iron chains and torn blank treaty scrolls exploding outward while a radiant crimson phoenix-dragon rises from the debris, shockwave clearing sticky fog banks from the air, triumphant reset-and-strike satire, explosive radial composition."),
  card("js-dragon-fire", "jin-shi", "legendary", "Legendary maximum orange-gold punch: a crimson industrial dragon exhaling a molten industrial-gold beam that melts rival cartoon plating into scrap while the same breath photocopies the rival's glowing aura into a stolen twin-flame, melt-plus-theft satire, diagonal breath composition, comedy metal slag only."),
];

export const VLADO_CARDS: LockedAsset[] = [
  card("vz-speech", "vlado-zelenko", "common", "Common FX: flat lighting, modest collage grain. Visual scene: empty chamber podium draped in blue-gold ribbons, microphone forest, camera-flash starbursts, blank speech pages transforming into blue-gold motion streaks racing outward — satire of a dramatic address, no faces."),
  card("vz-green", "vlado-zelenko", "common", "Common FX: flat lighting, simple relic prop. Visual scene: iconic empty olive-green t-shirt displayed on a cracked stone pedestal like sacred cloth, soft protective cyan-gold aura, tiny cartoon shield charms orbiting the fabric — satire of folk-president wardrobe as sacred shield-cloth, no wearer."),
  card("vz-drone", "vlado-zelenko", "common", "Common FX: limited motion streaks. Visual scene: cartoon racing quadcopter diving through smoke rings, lens-flare camera eye, blue-yellow stickers on arms, spark kiss on a cardboard tank silhouette far below — clean FPV satire, night searchlight shafts, no wreckage gore."),
  card("vz-javelin", "vlado-zelenko", "common", "Common FX: modest orange-gold impact bloom. Visual scene: oversized satirical tube launcher loosing a glowing gold spear on a top-attack arc, blue exhaust plume, distant toy armored vehicle silhouette, abstract sunflower graphic shapes in the field — no people."),
  card("vz-comedian", "vlado-zelenko", "common", "Common FX: single hard spotlight. Visual scene: brick comedy-club wall, chrome microphone on stand, concentric laughter shockwaves freezing a rival pocket-watch gear mid-tick, stage curtains in blue and gold — empty stage, no performer face."),
  card("vz-resilience", "vlado-zelenko", "common", "Common FX: dim rim, bright core glow. Visual scene: cracked round shield resealing with molten gold seams, blue-yellow flag fragments knitting themselves, anonymous gloved fist raised, sparks of resolve rising — satire of stubborn endurance, no faces."),
  card("vz-nato", "vlado-zelenko", "rare", "Rare FX: cool blue rim light, one strong protective dome. Visual scene: abstract compass-rose aegis (NOT any real alliance emblem), orbiting cartoon stars forming a constellation shield, soft gold light-rain inside a translucent blue force dome — allied umbrella satire, no people."),
  card("vz-himars", "vlado-zelenko", "rare", "Rare FX: cool night rim, razor gold trail lines. Visual scene: cartoon wheeled rocket truck angled upward, six glowing trails drawing precise gold lines into the dark, pinpoint star-bursts on distant red X marks, blue-yellow chevron paint patches, empty cab — precision-strike satire."),
  card("vz-selfie", "vlado-zelenko", "rare", "Rare FX: blue flash rim, clear motion echo. Visual scene: oversized smartphone on a stick photographing sandbags and blue-yellow tape, camera-flash nova cloning a glowing ghost-copy of the trench scene behind the phone — mirror-echo media satire, blank screen, no faces."),
  card("vz-press", "vlado-zelenko", "rare", "Rare FX: cool flash storm, blue rim. Visual scene: long briefing table buried under a microphone forest, blizzard of camera starbursts, floating blank newspaper collage sheets, enemy pocket-watches freezing mid-tick — press-tempo satire, empty chairs, no faces."),
  card("vz-macro", "vlado-zelenko", "rare", "Rare FX: cool blue lattice rim, one strong seal glow. Visual scene: glowing blank parchment scrolls and wax seals wrapping into a translucent hexagonal shield dome, fountain-pen nibs as decorative spears, gold seals locking a blue protective lattice — security-guarantee satire, no writing."),
  card("vz-cluster", "vlado-zelenko", "rare", "Rare FX: cool blue rim, twin orange spark rings. Visual scene: single cartoon canister splitting into a swarm of glowing seed-stars raining in a staggered double wave, two concentric spark rings on barren ground, blue-yellow stripe on the canister — toy-like munition satire, dust and light only, no bodies."),
  card("vz-counteroffensive", "vlado-zelenko", "epic", "Epic FX: violet glow-veins in the barrier cracks, surreal arrow scale, dramatic backlight. Visual scene: stylized map board with bold blue-gold chevron arrows punching through a crumbling red wall, geometric metal shards flying, sweeping advance motion — no soldiers, no map labels."),
  card("vz-bradley", "vlado-zelenko", "epic", "Epic FX: violet sparks at siphon vents, dramatic side backlight. Visual scene: chunky cartoon tracked fighting vehicle charging forward, turret sparking, sucking a glowing green orb from a cracked rival battery crate into hull vents, blue-yellow chevron patches, dust rooster tail, empty vehicle — allied IFV satire."),
  card("vz-azov", "vlado-zelenko", "epic", "Epic FX: violet rim in furnace glow, denser industrial collage, dramatic backlight. Visual scene: colossal steel-mill silhouette as impregnable bunker-castle, riveted plates, smokestack towers, blast doors sealing behind cyan force walls, ambient forge sparks — fortress satire, no combatants, no unit insignia."),
  card("vz-zelensky-on-air", "vlado-zelenko", "epic", "Epic FX: violet scanlines, surreal screen stack, dramatic studio backlight. Visual scene: broadcast studio with glowing red lamp shape (no letters), floating CRT and flat screens erasing swirling dark hex-glyphs with a white cleanup beam, empty chair, microphone cluster — live-air purge satire, blank screens, no faces."),
  card("vz-slava", "vlado-zelenko", "legendary", "Legendary FX: hot orange-gold radiance, monumental vertical banners, brightest contrast. Visual scene: monumental blue-and-gold banners exploding upward into a speed-line vortex, abstract tryzub lightburst at center, shockwave rings racing outward through gold particle rain — glory-surge satire, no people, no slogans."),
  card("vz-iron-resolve", "vlado-zelenko", "legendary", "Legendary FX: hot orange-gold forge radiance, monumental iron core. Visual scene: massive iron heart-anvil hybrid cracked then re-forging with molten gold veins, unbreakable chain links reattaching, last-stand ember glow, a single stubborn spark refusing to die — iron-will satire, soft cyan rim, no faces."),
  card("vz-trident", "vlado-zelenko", "legendary", "Legendary FX: hot orange-gold lightning, max monumental punch. Visual scene: gigantic stylized tryzub of pure gold #FFD500 and blue #005BBB radiance descending like a divine spear, lightning forks splitting darkness, shockwave that shatters red crystals while raining shimmering gold petals — ultimate trident satire, no people."),
  card("vz-freedom", "vlado-zelenko", "legendary", "Legendary FX: hot orange-gold sunrise radiance, brightest contrast. Visual scene: shattered iron chains exploding into blue-gold wings, sunrise flare behind, swarm of blank paper rectangles rocketing forward as liberated pamphlets with motion chevrons — will-to-victory satire, no people, no slogans."),
];

export const SHARED_ASSETS: LockedAsset[] = [
  {
    id: "arena-default",
    file: "arena/default.webp",
    kind: "shared",
    width: 1920,
    height: 1080,
    visualCore:
      "Wide 16:9 full-bleed geopolitical duel arena background, split left-right opposing stages, muted dark zinc void with subtle flag-color accents (USA navy/red, Russia cold-red, China crimson-gold, Ukraine blue-gold), faint world-map collage fragments, soft VS glow on center horizon, quieter center and lower third for fighters and overlays, empty floors, no characters, no readable text.",
    alpha: false,
  },
  {
    id: "card-back",
    file: "cards/card-back.webp",
    kind: "shared",
    width: 360,
    height: 540,
    visualCore:
      "Vertical 2:3 full-bleed card back surface, classified dossier aesthetic, ornate geometric border, centered globe pierced by chess king and rook silhouettes, dark zinc field with gold #D4AF37 filigree, symmetrical occult-geopolitics emblem, abstract decorative glyphs only (illegible), no real language letters, premium mysterious seal mood.",
    alpha: false,
  },
  {
    id: "fallback-common",
    file: "cards/fallback-common.webp",
    kind: "shared",
    width: 360,
    height: 540,
    rarity: "common",
    visualCore:
      "Vertical 2:3 empty art-well placeholder, zinc-gray #8A9BA8 common border glow only, large empty dark center rectangle for future artwork, subtle corner brackets, no illustration inside, no labels, no icons, flat lighting vacancy.",
    alpha: false,
  },
  {
    id: "fallback-rare",
    file: "cards/fallback-rare.webp",
    kind: "shared",
    width: 360,
    height: 540,
    rarity: "rare",
    visualCore:
      "Vertical 2:3 empty art-well placeholder, cool blue #4A90D9 rare border glow and inner rim light only, empty dark center panel, thin luminous edge, no labels, no icons, vacancy ready for paste-in art.",
    alpha: false,
  },
  {
    id: "fallback-epic",
    file: "cards/fallback-epic.webp",
    kind: "shared",
    width: 360,
    height: 540,
    rarity: "epic",
    visualCore:
      "Vertical 2:3 empty art-well placeholder, violet #9B59B6 epic crackle border with subtle sparks along edges only, empty dark center panel, richer ornament than rare but still empty, no labels, no icons.",
    alpha: false,
  },
  {
    id: "fallback-legendary",
    file: "cards/fallback-legendary.webp",
    kind: "shared",
    width: 360,
    height: 540,
    rarity: "legendary",
    visualCore:
      "Vertical 2:3 empty art-well placeholder, hot orange #E67E22 to gold #D4AF37 legendary ornate border with premium filigree corners and soft sunburst rim light only, empty dark center panel reserved for artwork, maximum frame prestige, no labels, no icons, no center illustration.",
    alpha: false,
  },
];

/** Optional TZ parallax layers (stretch). */
export const ARENA_LAYERS: LockedAsset[] = [
  { id: "usa-sky", file: "arenas/usa/sky.webp", kind: "arena-layer", width: 1920, height: 1080, visualCore: "Wide caricature dusk sky gradient navy-to-indigo with soft cartoon clouds and distant stadium light beams, US navy #1A3A6B and stripe-red #B22234 rim glow, empty sky layer only, no buildings, no characters, no readable text, parallax-ready flat painting.", alpha: false },
  { id: "usa-bg1", file: "arenas/usa/bg1_capitol.webp", kind: "arena-layer", width: 1920, height: 900, visualCore: "Distant caricature neoclassical capitol dome skyline silhouette on transparent soft-edged layer, simplified columns, newspaper collage texture, centered low horizon, no people, no readable inscriptions, parallax far layer.", alpha: true },
  { id: "usa-bg2", file: "arenas/usa/bg2_flags.webp", kind: "arena-layer", width: 1920, height: 700, visualCore: "Midground row of stylized waving flag poles with abstract star-stripe patterns (NOT exact national logos), confetti-like paper scraps, soft red-blue bunting, transparent edges for ParallaxLayer, no characters, no readable text.", alpha: true },
  { id: "usa-floor", file: "arenas/usa/floor_marble.webp", kind: "arena-layer", width: 1920, height: 540, visualCore: "Top-down marble checker arena floor, cool gray-white with subtle blue-red veins, satirical cartoon polish, seamless-ish tile, no text, no people.", alpha: false },
  { id: "russia-sky", file: "arenas/russia/sky_night.webp", kind: "arena-layer", width: 1920, height: 1080, visualCore: "Deep night sky caricature, cold black-crimson gradient with #CC0000 haze near horizon, sparse cartoon stars, oppressive stillness, empty sky only, no characters, no text.", alpha: false },
  { id: "russia-bg1", file: "arenas/russia/bg1_kremlin.webp", kind: "arena-layer", width: 1920, height: 900, visualCore: "Distant fortress-wall and tower silhouettes (generic onion-dome parody, NOT landmark photography), cold-war red accents, bold outlines, transparent far layer, no people, no readable banners.", alpha: true },
  { id: "russia-bg2", file: "arenas/russia/bg2_snow.webp", kind: "arena-layer", width: 1920, height: 700, visualCore: "Midground drifting snowflake clusters and mist banks as soft particle shapes on transparent layer, pale gray-white, light parallax snow curtain, no characters.", alpha: true },
  { id: "russia-floor", file: "arenas/russia/floor_stone.webp", kind: "arena-layer", width: 1920, height: 540, visualCore: "Dark stone cobble arena floor, frozen sheen, crimson undertone cracks, cartoon tile readability, no text.", alpha: false },
  { id: "china-sky", file: "arenas/china/sky_dusk.webp", kind: "arena-layer", width: 1920, height: 1080, visualCore: "Propaganda-crimson dusk sky #DE2910 to deep plum, industrial gold #FFDE00 sun disc low and stylized, layered cloud bands, empty sky, no characters, no text.", alpha: false },
  { id: "china-bg1", file: "arenas/china/bg1_forbidden_city.webp", kind: "arena-layer", width: 1920, height: 900, visualCore: "Far caricature palace roof ridges and gate silhouette (generic imperial complex parody), dragon-scale roof rhythm, bold outlines, transparent PNG, no people, no readable plaques.", alpha: true },
  { id: "china-bg2", file: "arenas/china/bg2_lanterns.webp", kind: "arena-layer", width: 1920, height: 700, visualCore: "Midground floating red paper lanterns and ember sparks on transparent layer, warm glow, orderly rows, no characters, no glyphs.", alpha: true },
  { id: "china-floor", file: "arenas/china/floor_red.webp", kind: "arena-layer", width: 1920, height: 540, visualCore: "Deep red lacquered arena floor with subtle gold geometric inlay, cartoon polish, no text.", alpha: false },
  { id: "ukraine-sky", file: "arenas/ukraine/sky_dawn.webp", kind: "arena-layer", width: 1920, height: 1080, visualCore: "Dawn sky split horizontally #005BBB upper cool blue into #FFD500 lower gold band (flag-sky metaphor), soft smoke haze, hopeful defiance light under harsh spotlight mood, empty sky, no characters, no text.", alpha: false },
  { id: "ukraine-bg1", file: "arenas/ukraine/bg1_bunker.webp", kind: "arena-layer", width: 1920, height: 900, visualCore: "Far sandbag and bunker silhouette skyline, concrete blocks, antenna masts, bold caricature outlines, transparent, blue-yellow tape accents, no people, no insignia text.", alpha: true },
  { id: "ukraine-bg2", file: "arenas/ukraine/bg2_flames.webp", kind: "arena-layer", width: 1920, height: 700, visualCore: "Midground stylized orange spark columns and smoke plumes (abstract flames, not gore), transparent edges, ambient war atmosphere without bodies, no characters.", alpha: true },
  { id: "ukraine-floor", file: "arenas/ukraine/floor_concrete.webp", kind: "arena-layer", width: 1920, height: 540, visualCore: "Cracked concrete arena floor, chalk marks and chevron paint hints in blue-yellow, cartoon grit, no readable writing.", alpha: false },
  { id: "mirror-sky", file: "arenas/mirror/sky.webp", kind: "arena-layer", width: 1920, height: 1080, visualCore: "Oppressive moot underground false-sky: dark green-black void #050805 with sickly #39ff14 grid glow like bunker monitors reflecting upward, empty, no characters, no text.", alpha: false },
  { id: "mirror-bg1", file: "arenas/mirror/bg1_bunker_core.webp", kind: "arena-layer", width: 1920, height: 900, visualCore: "Far concrete blast-door and cooling-pipe cathedral silhouette, radiation-warning triangle shapes without readable words, neon acid-green edge light, transparent, no people.", alpha: true },
  { id: "mirror-bg2", file: "arenas/mirror/bg2_hazmat.webp", kind: "arena-layer", width: 1920, height: 700, visualCore: "Midground floating hazard stripes, dangling cables, green warning lamps as abstract shapes on transparent layer, eerie mirror-match tension, no characters, no readable labels.", alpha: true },
  { id: "mirror-floor", file: "arenas/mirror/floor_metal.webp", kind: "arena-layer", width: 1920, height: 540, visualCore: "Scratched metal grate arena floor, olive-black with neon green edge lines, cartoon industrial readability, no text.", alpha: false },
];

export function getAllLockedAssets(includeArenaLayers = true): LockedAsset[] {
  return [
    ...PORTRAITS,
    ...DONALD_CARDS,
    ...VLADIMIR_CARDS,
    ...JIN_CARDS,
    ...VLADO_CARDS,
    ...SHARED_ASSETS,
    ...(includeArenaLayers ? ARENA_LAYERS : []),
  ];
}

export function getCoreLockedAssets(): LockedAsset[] {
  return getAllLockedAssets(false);
}
