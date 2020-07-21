/******************************************************************************

COVID-19 map viewer

Copyright (c) 2020  David Brooks

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

******************************************************************************/

'use strict';

//==============================================================================

import {default as booleanPointInPolygon} from '@turf/boolean-point-in-polygon';
import * as turf from '@turf/helpers';

//==============================================================================

// Maximum number of points in a movement trace

const MAX_HISTORY = 5;

//==============================================================================

class Actor
{
    constructor(id)
    {
        this._id = id;
        this._position = [];
        this._status = [];
    }

    get status()
    //==========
    {
        return this._status;
    }

    addPoint(timeIndex, position, status)
    //===================================
    {
        if (timeIndex !== this._position.length) {
            console.log(`Didn't add point ${timeIndex} for actor ${this._id} -- out of sequence?`);
        } else {
            this._position.push(position);
            this._status.push(status);
        }
    }

    featuresAtIndex(timeIndex)
    //========================
    {
        const features = [];
        if (timeIndex > this._position.length) {
            console.log(`Invalid time index for actor ${this._id}`);
        } else {
            const linePoints = [];
            let lastPos = [-1, -1];
            for (let n = 0; n < MAX_HISTORY && timeIndex >= 0; n++, timeIndex--) {
                const position = this._position[timeIndex];
                if (position[0] !== 0 && position[1] !== 0
                 && (position[0] !== lastPos[0] || position[1] !== lastPos[1])) {
                    const status = this._status[timeIndex];
                    if (['S', 'E', 'I', 'R', 'D'].indexOf(status) < 0) {
                        console.log('Unknown status:', status);
                    }
                    features.push(turf.point(position, {'id': this._id, 'status': status, 'order': n}));
                    linePoints.push(position);
                    lastPos = position;
                }
            }
            if (linePoints.length > 1) {
                features.push(turf.lineString(linePoints.reverse(), {'id': this._id}));
            }
        }
        return features;
    }

    inBuilding(timeIndex, building)
    //=============================
    {
        return building.type === 'Polygon'
               && booleanPointInPolygon(
                    turf.point(this._position[timeIndex]),
                    turf.polygon(building.coordinates));
    }
}

//==============================================================================

export class SimulationData
{
    constructor()
    {
        this._times = [];
        this._actors = new Map();
    }

    addTimeStep(time, actors)
    //=======================
    {
        const index = this._times.length;
        this._times.push(time);
        for (const actor of actors) {
            const id = actor.id;
            if (!this._actors.has(id)) {
                this._actors.set(id, new Actor(id));
            }
            this._actors.get(id).addPoint(index, actor.position, actor.status);
        }
    }

    limitIndex(timeIndex)
    //===================
    {
        return (timeIndex < 0) ? 0
             : (timeIndex >= this._times.length) ? this._times.length - 1
             : timeIndex;
    }

    featuresAtIndex(timeIndex)
    //========================
    {
        const features = [];
        timeIndex = this.limitIndex(timeIndex);
        for (const actor of this._actors.values()) {
            features.push(...actor.featuresAtIndex(timeIndex));
        }
        return turf.featureCollection(features);
    }

    featuresAtTime(time)
    //==================
    {
        return this.featuresAtIndex(this._times.indexOf(time));
    }

    actorsInBuildingAtIndex(timeIndex, building)
    //==========================================
    {
        const counts = {'building': 0, 'S': 0, 'E': 0, 'I': 0, 'R': 0, 'D': 0};
        timeIndex = this.limitIndex(timeIndex);
        for (const actor of this._actors.values()) {
            if (actor.inBuilding(timeIndex, building)) {
                counts.building += 1;
                counts[actor.status[timeIndex]] += 1;
            }
        }
        return counts;
    }
}
