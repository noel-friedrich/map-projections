import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectionState, projectPoint, getProjectionCheckpoints, getNextProjectionCheckpoint, getPreviousProjectionCheckpoint } from '../js/projections.js';
import { CONIC_PARALLELS, CONIC_LATITUDE_MIN, CONIC_LATITUDE_MAX, conicParameters } from '../js/conic.js';
import { constructionStageLabel, constructionStages } from '../js/construction-stages.js';
import { localDistortion, measureProjectionDistortion } from '../js/distortion.js';
import { distortionScores } from '../js/distortion-data.js';

const degrees = value => value * Math.PI / 180;
const close = (a,b,tolerance=1e-6) => assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const point = (type,progress,longitude,latitude) => {
    const p = projectPoint(longitude,latitude,getProjectionState(type,progress),{});
    return [p.x,p.y,p.z];
};
const distance = (a,b) => Math.hypot(...a.map((value,i)=>value-b[i]));
const geographic = (longitude,latitude) => [Math.cos(latitude)*Math.sin(longitude),Math.sin(latitude),Math.cos(latitude)*Math.cos(longitude)];
const local = (type,progress,longitude,latitude) => {
    const state=getProjectionState(type,progress);
    return localDistortion(direction=>{
        const p=projectPoint(Math.atan2(direction[0],direction[2]),Math.asin(direction[1]),state,{});
        return [p.x,p.y,p.z];
    },geographic(longitude,latitude));
};

for (const type of ['lambert-conic','albers']) {
    test(`${type}: shared hemisphere, standard parallels and five distinct construction stages`,()=>{
        const state=getProjectionState(type,0);
        close(state.latitudeMin,CONIC_LATITUDE_MIN);close(state.latitudeMax,CONIC_LATITUDE_MAX);
        assert.deepEqual(getProjectionCheckpoints(type),[0,0.25,0.5,0.75,1]);
        for(const latitude of [degrees(10),degrees(45),degrees(80)]) for(const longitude of [-2,0,2]) {
            const globe=point(type,0,longitude,latitude);
            close(distance(globe,geographic(longitude,latitude)),0);
            const cone=point(type,0.25,longitude,latitude),direction=geographic(longitude,latitude);
            close(cone[0]*direction[1]-cone[1]*direction[0],0);
            close(cone[1]*direction[2]-cone[2]*direction[1],0);
            const {n,c,apex}=conicParameters(type);
            close(c*Math.hypot(cone[0],cone[2]),n*(apex-cone[1]));
            close(point(type,0.75,longitude,latitude)[2],1);
            close(point(type,1,longitude,latitude)[2],1);
        }
        close(distance(point(type,0.25,-Math.PI,degrees(45)),point(type,0.25,Math.PI,degrees(45))),0);
        assert.ok(distance(point(type,0.5,-Math.PI,degrees(45)),point(type,0.5,Math.PI,degrees(45)))>0.1);
        assert.ok(distance(point(type,0.75,0,degrees(80)),point(type,1,0,degrees(80)))>0.001);
    });
    test(`${type}: opening and flattening preserve cone distances and local distortion`,()=>{
        const before=local(type,0.25,0.7,degrees(40));
        for(const progress of [0.5,0.6,0.75]) {
            const after=local(type,progress,0.7,degrees(40));
            close(after.area,before.area,1e-5);close(after.angle,before.angle,1e-5);
            const meridian=distance(point(type,progress,0.7,degrees(20)),point(type,progress,0.7,degrees(70)));
            close(meridian,Math.abs(conicParameters(type).rawRho(degrees(20))-conicParameters(type).rawRho(degrees(70))));
        }
    });
    test(`${type}: final map has true scale on both standard parallels`,()=>{
        const step=1e-6;
        for(const latitude of CONIC_PARALLELS) {
            const a=point(type,1,0.5-step,latitude),b=point(type,1,0.5+step,latitude);
            close(distance(a,b)/(2*step*Math.cos(latitude)),1);
        }
    });
}

test('Lambert conic preserves angles and Albers preserves area throughout the displayed region',()=>{
    for(const latitude of [degrees(5),degrees(30),degrees(45),degrees(60),degrees(80)]) for(const longitude of [-2,0.2,2]) {
        close(local('lambert-conic',1,longitude,latitude).angle,0,1e-4);
        close(local('albers',1,longitude,latitude).area,1,1e-5);
    }
    assert.equal(measureProjectionDistortion('lambert-conic',4096).angleError,0);
    assert.equal(measureProjectionDistortion('albers',4096).areaDifference,0);
    assert.equal(distortionScores['lambert-conic'].angleError,0);
    assert.equal(distortionScores.albers.areaDifference,0);
});

test('Winkel construction has a hemisphere, disk, Aitoff ellipse and direct final blend',()=>{
    assert.deepEqual(getProjectionCheckpoints('winkel-tripel'),[0,0.25,0.5,0.75,1]);
    for(const longitude of [-Math.PI,-1,0,1,Math.PI]) for(const latitude of [-Math.PI/2,-0.7,0,0.7,Math.PI/2]) {
        close(distance(point('winkel-tripel',0,longitude,latitude),geographic(longitude,latitude)),0);
        const hemisphere=point('winkel-tripel',0.25,longitude,latitude);
        close(Math.hypot(...hemisphere),1);assert.ok(hemisphere[2]>=-1e-8);
        const disk=point('winkel-tripel',0.5,longitude,latitude);
        const ellipse=point('winkel-tripel',0.75,longitude,latitude);
        close(ellipse[0],2*disk[0]);close(ellipse[1],disk[1]);
        if(Math.abs(longitude)===Math.PI) close(Math.hypot(disk[0],disk[1]),Math.PI/2);
        const rectangle=[longitude*2/Math.PI,latitude,1];
        const final=point('winkel-tripel',1,longitude,latitude);
        close(final[0],(ellipse[0]+rectangle[0])/2);close(final[1],(ellipse[1]+rectangle[1])/2);close(final[2],1);
        const midway=point('winkel-tripel',0.875,longitude,latitude);
        close(midway[0],(ellipse[0]+final[0])/2);close(midway[1],(ellipse[1]+final[1])/2);
        if(latitude===0) close(final[0],longitude*(1+2/Math.PI)/2);
        if(Math.abs(latitude)===Math.PI/2) {close(final[0],longitude/Math.PI);close(final[1],latitude);}
    }
    close(distance(point('winkel-tripel',1,0,0),[0,0,1]),0);
    const score=measureProjectionDistortion('winkel-tripel',4096);
    assert.ok(score.areaDifference>16&&score.areaDifference<20);
    assert.ok(score.angleError>22&&score.angleError<25);
});

test('new animations remain finite and continuous at every stage boundary',()=>{
    for(const type of Object.keys(constructionStages)) {
        const min=type==='winkel-tripel'?-Math.PI/2:CONIC_LATITUDE_MIN;
        const max=type==='winkel-tripel'?Math.PI/2:CONIC_LATITUDE_MAX;
        for(let i=0;i<=100;i++) {
            const state=getProjectionState(type,i/100);
            for(const longitude of [-Math.PI,-1,0,1,Math.PI]) for(const latitude of [min,(min+max)/2,max]) {
                const p=projectPoint(longitude,latitude,state,{});
                assert.ok([p.x,p.y,p.z].every(Number.isFinite),`${type}/${i}`);
            }
        }
        const checkpoints=getProjectionCheckpoints(type);
        for(const progress of checkpoints.slice(1,-1)) {
            const before=point(type,progress-1e-8,1,(min+max)/2),after=point(type,progress+1e-8,1,(min+max)/2);
            assert.ok(distance(before,after)<1e-5,`${type} discontinuity at ${progress}`);
        }
        assert.equal(constructionStageLabel(type,0),constructionStages[type][0]);
        assert.equal(constructionStageLabel(type,1),constructionStages[type].at(-1));
        for(let i=0;i<checkpoints.length;i++) {
            close(getNextProjectionCheckpoint(type,checkpoints[i]),checkpoints[(i+1)%checkpoints.length]);
            close(getPreviousProjectionCheckpoint(type,checkpoints[i]),checkpoints[(i+checkpoints.length-1)%checkpoints.length]);
        }
    }
    assert.equal(constructionStageLabel('mercator',0.5),'');
});
