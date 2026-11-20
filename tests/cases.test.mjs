import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES,caseViewPolicy} from '../case-config.js';
import {followPointer} from '../interaction.js';
test('first case uses the working tooth; second uses the full jaw with a highlight',()=>{assert.deepEqual(caseViewPolicy(1),{view:'tooth',highlight:false,canTreat:true});assert.deepEqual(caseViewPolicy(2),{view:'mouth',highlight:true,canTreat:false});});
test('third and subsequent cases never inherit the highlighted tooth',()=>{for(const c of CASES.filter(c=>c.id>=3)){const policy=caseViewPolicy(c.id);assert.equal(policy.view,'mouth');assert.equal(policy.highlight,false);}assert.equal(new Set(CASES.map(c=>c.id)).size,CASES.length);});
test('locked signed angles can span minus 180 through plus 180',()=>{for(const angle of [-180,-90,0,90,180])assert.deepEqual(followPointer([3,4,2],[0,4,0],{tilt:angle,yaw:angle,tiltLocked:true,yawLocked:true}),{tilt:angle,yaw:angle});});
