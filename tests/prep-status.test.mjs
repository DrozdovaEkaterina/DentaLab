import test from 'node:test';import assert from 'node:assert/strict';import {prepStatus} from '../prep-status.js';
const s={removedVolume:2,critical:false},review={diagnosed:true,isolated:true,reviewed:true};
test('preparation requires treatment and an explicit visual review',()=>{assert.equal(prepStatus(s,{...review,reviewed:false}).ready,false);assert.equal(prepStatus({...s,removedVolume:0},review).ready,false);assert.equal(prepStatus(s,review).ready,true);});
test('pulp injury blocks success even when the learner confirmed all checks',()=>{const status=prepStatus({...s,critical:true},{...review,complete:true});assert.equal(status.ready,false);assert.equal(status.done,false);assert.match(status.title,/Остановитесь/);});
test('an unprepared field cannot complete the stage',()=>{assert.equal(prepStatus(s,{...review,isolated:false}).ready,false);assert.equal(prepStatus(s,{...review,diagnosed:false}).ready,false);});
test('ready and explicitly completed are separate states',()=>{assert.equal(prepStatus(s,review).done,false);assert.equal(prepStatus(s,{...review,complete:true}).done,true);assert.equal(prepStatus(s,review).progress,100);});
