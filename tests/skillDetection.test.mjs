import assert from 'node:assert/strict';
import { SKILLS } from '../js/skills.js';

const frame = (t, y, extra = {}) => ({
  t, y,
  belowShoulder: true,
  aboveHead: false,
  aboveBrow: false,
  bothWrists: false,
  bothBelowShoulder: false,
  bothAboveBrow: false,
  knee: 140,
  wristGap: null,
  wristHigh: 0,
  elbowMax: 160,
  elbowMean: null,
  armCount: 1,
  armAsym: null,
  jumpRise: 0,
  airborne: false,
  ...extra,
});

const rising = (shape) => [
  frame(0, 0.8, shape), frame(0.1, 0.72, shape),
  frame(0.2, 0.6, shape), frame(0.3, 0.62, shape),
];
const overhead = (shape) => [
  frame(0, 0.7, shape), frame(0.1, 0.5, shape),
  frame(0.2, 0.4, shape), frame(0.3, 0.46, shape),
];

const bump = rising({
  bothWrists: true, bothBelowShoulder: true, wristGap: 0.1,
  armCount: 2, armAsym: 4, elbowMax: 170, elbowMean: 168,
});
const set = overhead({
  belowShoulder: false, aboveHead: true, aboveBrow: true,
  bothWrists: true, bothAboveBrow: true, wristGap: 0.1,
  armCount: 2, armAsym: 8, elbowMax: 120, elbowMean: 105,
});
const underhand = rising({ wristGap: 0.3, armCount: 2, armAsym: 45, elbowMax: 165 });
const overhand = overhead({
  belowShoulder: false, aboveHead: true, aboveBrow: true,
  bothWrists: true, wristGap: 0.3, armCount: 2,
  armAsym: 50, elbowMax: 155, elbowMean: 125,
});
const spike = [frame(0.5, 0.35, {
  belowShoulder: false, aboveHead: true, aboveBrow: true,
  airborne: true, jumpRise: 12, elbowMax: 155, wristHigh: 20,
})];

const validCases = {
  selfBump: bump,
  tossBump: bump,
  selfSet: set,
  tossSet: set,
  underhand,
  overhand,
  spike,
};
for (const [id, series] of Object.entries(validCases)) {
  assert.ok(SKILLS[id].detect(series, -Infinity), `${id} should accept its own gesture`);
}

assert.equal(SKILLS.tossSet.detect(spike, -Infinity), false, 'set must reject a spike');
assert.equal(SKILLS.overhand.detect(set, -Infinity), false, 'overhand serve must reject a set');
assert.equal(SKILLS.tossBump.detect(underhand, -Infinity), false, 'bump must reject underhand serve');
assert.equal(SKILLS.underhand.detect(bump, -Infinity), false, 'underhand serve must reject bump');
assert.equal(SKILLS.overhand.detect(spike, -Infinity), false, 'overhand serve must reject airborne spike');
assert.equal(SKILLS.spike.detect(spike, 0.5), false, 'spike debounce must reject duplicate event');

assert.ok(!SKILLS.selfBump.tableKeys.some(([key]) => key === 'trunk'));
assert.ok(!SKILLS.selfBump.reportMap.some((part) => part.keys?.includes('trunk')));

console.log('skill detection regression: passed');
