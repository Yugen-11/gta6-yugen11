// Palmar Bay — the story. Six missions from Mama Rosa, from a first fare
// across town to the big bank job on the pier. Each mission is a list of
// steps the manager checks every frame; a glowing beacon marks the target,
// Rosa and the others talk over the subtitles, and finishing pays cash.

import * as THREE from 'three';
import { LOCATIONS } from './city.js';
import { MISSION_REWARDS } from './config.js';
import { Enemy } from './combat.js';
import { Car } from './vehicles.js';

export const MISSION_DEFS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    giver: 'Mama Rosa',
    intro: [
      ['Mama Rosa', 'Jax, sayang. Mama needs a driver who does not ask questions.'],
      ['Mama Rosa', 'Pick up my client at the cafe. Take him to Hotel Miramar. Drive like you mean it.'],
    ],
    outro: [
      ['Client', 'Smooth ride, kid. Rosa picks good drivers.'],
      ['Mama Rosa', 'See? Easy money. Come back when you want real work.'],
    ],
    steps: [
      { type: 'goto', at: 'cafe', radius: 7, text: 'Pick up the client at Rosa\'s Cafe' },
      { type: 'goto', at: 'hotel', radius: 9, text: 'Drop the client at Hotel Miramar' },
    ],
  },
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    giver: 'Mama Rosa',
    intro: [
      ['Mama Rosa', 'A red Comet GT just rolled into Comet Motors. Pretty, fast, and not ours.'],
      ['Mama Rosa', 'Borrow it. Bring it to Diz\'s Garage. The cops will notice — they always do.'],
    ],
    outro: [
      ['Diz', 'A Comet GT! Jax, you beautiful thief. This one is going to pay for itself.'],
    ],
    steps: [
      { type: 'goto', at: 'dealership', radius: 8, text: 'Get to Comet Motors' },
      { type: 'enterCar', car: 'comet', text: 'Steal the red Comet GT' },
      { type: 'driveTo', at: 'garage', radius: 9, car: 'comet', text: 'Bring the Comet GT to Diz\'s Garage' },
    ],
  },
  {
    id: 'the-drop',
    title: 'The Drop',
    giver: 'Mama Rosa',
    intro: [
      ['Mama Rosa', 'A package is waiting in the alley behind the cafe. No car — walk, blend in.'],
      ['Mama Rosa', 'The Vipers want it too. If they show up, you know what to do.'],
    ],
    outro: [
      ['Mama Rosa', 'Delivered, and the Vipers are eating pavement. You are worth every dollar, Jax.'],
    ],
    steps: [
      { type: 'goto', at: 'alley', radius: 6, text: 'Pick up the package in the alley' },
      { type: 'deliver', at: 'pier', radius: 9, text: 'Deliver the package to the pier — the Vipers are coming' },
    ],
  },
  {
    id: 'hot-pursuit',
    title: 'Hot Pursuit',
    giver: 'Diz',
    intro: [
      ['Diz', 'The cops are all over this part of town tonight, Jax. Three stars, easy.'],
      ['Diz', 'Lose them, then get to the safehouse. Do not lead them to my door.'],
    ],
    outro: [
      ['Diz', 'Clean. You drive like the road owes you money.'],
    ],
    steps: [
      { type: 'wanted', stars: 3, text: 'The heat is on — reach 3 stars' },
      { type: 'escape', at: 'safehouse', radius: 10, text: 'Lose the cops, then reach the safehouse' },
    ],
  },
  {
    id: 'payback',
    title: 'Payback',
    giver: 'Mama Rosa',
    intro: [
      ['Mama Rosa', 'The Vipers hit one of my drivers last night. That cannot stand.'],
      ['Mama Rosa', 'Their hideout is on the north side. Go and settle it. All five of them.'],
    ],
    outro: [
      ['Mama Rosa', 'Five down. The Vipers will think twice now. You did good, Jax.'],
    ],
    steps: [
      { type: 'goto', at: 'hideout', radius: 12, text: 'Get to the Viper hideout' },
      { type: 'defeat', count: 5, at: 'hideout', text: 'Settle it with the Vipers (0/5)' },
    ],
  },
  {
    id: 'the-big-one',
    title: 'The Big One',
    giver: 'Mama Rosa',
    intro: [
      ['Mama Rosa', 'Listen close, Jax. The Palmar Bay Bank. Friday. One job, and we never work again.'],
      ['Mama Rosa', 'Grab the cash, lose the cops, and meet the boat at the pier. Do not get caught.'],
    ],
    outro: [
      ['Mama Rosa', 'You did it. The whole city is looking for you — and you are already gone.'],
    ],
    steps: [
      { type: 'goto', at: 'bank', radius: 8, text: 'Get to the Palmar Bay Bank' },
      { type: 'grab', at: 'bank', radius: 6, text: 'Grab the cash from the vault' },
      { type: 'escape', at: 'pier', radius: 10, text: 'Escape to the boat at the pier' },
    ],
  },
];

export class MissionManager {
  constructor(scene, rng, ctx) {
    this.scene = scene;
    this.rng = rng;
    this.ctx = ctx; // { game, hud, police, traffic, effects, onSave, onAllComplete }
    this.index = 0;
    this.active = false;
    this.stepIndex = 0;
    this.missionCar = null;
    this.packageTaken = false;
    this.defeated = 0;
    this.dialogueQueue = [];
    this.dialogueTimer = 0;
    this.completeTimer = 0;
    this.started = false;

    // The beacon: a light pillar, a spinning diamond and a ground ring.
    this.marker = new THREE.Group();    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 70, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd23e,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    beam.position.y = 35;
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    diamond.position.y = 7;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    this.marker.add(beam, diamond, ring);
    this.marker.userData.diamond = diamond;
    this.marker.visible = false;
    scene.add(this.marker);
  }

  get current() {
    return MISSION_DEFS[this.index];
  }

  get done() {
    return this.index >= MISSION_DEFS.length;
  }

  get objective() {
    if (this.done) return 'Palmar Bay is yours. Free roam — the city never sleeps.';
    if (!this.active) return 'Talk to Mama Rosa — a new job is waiting.';
    const step = this.current.steps[this.stepIndex];
    if (!step) return this.current.title;
    if (step.type === 'defeat') {
      return `Settle it with the Vipers (${this.defeated}/${step.count})`;
    }
    return step.text;
  }

  get blip() {
    if (this.done || !this.active) return null;
    const step = this.current.steps[this.stepIndex];
    if (!step || !step.at) return null;
    return LOCATIONS[step.at];
  }

  say(lines) {
    this.dialogueQueue.push(...lines);
  }

  start(index = 0) {
    this.index = index;
    this.started = true;
    if (this.done) {
      this.active = false;
      this.marker.visible = false;
      return;
    }
    this.active = true;
    this.stepIndex = 0;
    this.packageTaken = false;
    this.defeated = 0;
    this.say(this.current.intro);
    this.updateMarker();
    this.ctx.game.missionName = `${this.index + 1}. ${this.current.title}`;
  }

  resetCurrent() {
    // After a bust or a trip to the hospital, the job restarts from its
    // first step — the client does not wait, but Rosa gives second chances.
    if (this.done) return;
    this.ctx.game.enemies.forEach((e) => e.remove());
    this.ctx.game.enemies = [];
    this.stepIndex = 0;
    this.packageTaken = false;
    this.defeated = 0;
    this._vipersSpawned = false;
    this._dropVipersSpawned = false;
    this.say([['Mama Rosa', 'Back on your feet? Good. The job is still waiting — start over.']]);
    this.updateMarker();
  }

  updateMarker() {
    const step = this.current?.steps[this.stepIndex];
    if (!step || !step.at) {
      this.marker.visible = false;
      return;
    }
    const loc = LOCATIONS[step.at];
    this.marker.position.set(loc.x, 0, loc.z);
    this.marker.visible = true;
  }

  spawnMissionCar(kind, color, x, z, heading) {
    const car = new Car(this.scene, kind, color, x, z, heading);
    this.ctx.game.looseCars.push(car);
    this.missionCar = car;
    return car;
  }

  spawnVipers(count, around, radius = 18) {
    for (let i = 0; i < count; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const dist = this.rng.range(8, radius);
      const enemy = new Enemy(
        this.scene,
        around.x + Math.cos(angle) * dist,
        around.z + Math.sin(angle) * dist,
        'viper',
      );
      this.ctx.game.enemies.push(enemy);
    }
  }

  advanceStep() {
    this.stepIndex++;
    if (this.stepIndex >= this.current.steps.length) {
      this.completeMission();
    } else {
      this.updateMarker();
    }
  }

  completeMission() {
    const mission = this.current;
    const reward = MISSION_REWARDS[this.index];
    this.ctx.game.money += reward;
    this.active = false;
    this.marker.visible = false;
    // Any gang members still standing walk away with the job done.
    this.ctx.game.enemies.forEach((e) => e.remove());
    this.ctx.game.enemies = [];
    this._vipersSpawned = false;
    this._dropVipersSpawned = false;
    this.ctx.hud.showBanner('MISSION COMPLETE', `${mission.title}  •  +$${reward.toLocaleString('en-US')}`);
    this.ctx.audio.missionJingle();
    this.say(mission.outro);
    this.index++;
    this.completeTimer = 5;
    this.ctx.onSave?.();
  }

  update(dt, playerPos, driving, playerCar) {
    // Dialogue plays one line at a time.
    if (this.dialogueQueue.length > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) {
        const [speaker, text] = this.dialogueQueue.shift();
        this.ctx.hud.showSubtitle(speaker, text, 4);
        this.dialogueTimer = 4.2;
      }
    }
    // After a mission, the next one starts on its own.
    if (this.completeTimer > 0) {
      this.completeTimer -= dt;
      if (this.completeTimer <= 0) {
        if (this.done) {
          this.ctx.onAllComplete?.();
        } else {
          this.start(this.index);
        }
      }
      return;
    }
    if (!this.active || this.done) return;

    // The beacon spins and bobs.
    this.marker.userData.diamond.rotation.y += dt * 2;
    this.marker.userData.diamond.position.y = 7 + Math.sin(this.ctx.game.time * 2) * 0.6;

    const step = this.current.steps[this.stepIndex];
    if (!step) return;
    const at = step.at ? LOCATIONS[step.at] : null;
    const distToTarget = at ? Math.hypot(playerPos.x - at.x, playerPos.z - at.z) : Infinity;

    switch (step.type) {
      case 'goto':
      case 'deliver':
        if (distToTarget < step.radius) {
          if (step.type === 'deliver' && !this.packageTaken) {
            // First arrival at the alley picks the package up.
            this.packageTaken = true;
            this.ctx.hud.showToast('Package picked up. Now get it to the pier.');
          }
          this.advanceStep();
        }
        break;
      case 'enterCar':
        if (playerCar && playerCar === this.missionCar) this.advanceStep();
        break;
      case 'driveTo':
        if (playerCar && playerCar === this.missionCar && distToTarget < step.radius) {
          this.advanceStep();
        }
        break;
      case 'wanted':
        if (this.ctx.police.wanted >= step.stars) this.advanceStep();
        break;
      case 'escape':
        // Hot Pursuit ends once the heat is gone and the safehouse is
        // reached; the Big One ends at the boat whatever the heat.
        if (distToTarget < step.radius) {
          if (this.current.id === 'the-big-one' || this.ctx.police.wanted === 0) {
            this.advanceStep();
          }
        }
        break;
      case 'grab':
        if (distToTarget < step.radius && !driving) {
          this.ctx.police.addHeat(4);
          this.spawnVipers(3, at, 16);
          this.ctx.hud.showBanner('THE VAULT IS OPEN', 'Grab the cash and run — 4 stars!');
          this.advanceStep();
        }
        break;
      case 'defeat':
        if (this.stepIndex === this.current.steps.findIndex((s) => s.type === 'defeat')) {
          // Spawn the Vipers once, when the step begins.
          if (!this._vipersSpawned) {
            this._vipersSpawned = true;
            this.spawnVipers(step.count, at, 20);
          }
        }
        this.defeated = step.count - this.ctx.game.enemies.filter((e) => !e.dead).length;
        if (this.ctx.game.enemies.length === 0 && this._vipersSpawned) {
          this._vipersSpawned = false;
          this.advanceStep();
        }
        break;
      default:
        break;
    }

    // Mission 2 needs its car on the lot before the player arrives.
    if (this.current.id === 'borrowed-wheels' && !this.missionCar && this.stepIndex === 0) {
      this.spawnMissionCar('sport', 0xd83a2c, LOCATIONS.dealership.x + 6, LOCATIONS.dealership.z + 4, Math.PI / 2);
    }
    // Mission 3's Vipers arrive when the package is picked up.
    if (this.current.id === 'the-drop' && this.packageTaken && !this._dropVipersSpawned) {
      this._dropVipersSpawned = true;
      this.spawnVipers(3, playerPos, 25);
    }
    // Mission 4 starts with the heat already on.
    if (this.current.id === 'hot-pursuit' && this.stepIndex === 0 && this.ctx.police.wanted < 3) {
      this.ctx.police.addHeat(3 - this.ctx.police.heat);
    }
  }
}
