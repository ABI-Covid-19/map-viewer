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

import mapboxgl from 'mapbox-gl';

//==============================================================================

export class SimulationControl
{
    constructor(map)
    {
        this._map = map;
    }

    getDefaultPosition()
    //==================
    {
        return 'top-right';
    }

    onAdd(map)
    //========
    {
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl simulation-ctrl';
        this._container.innerHTML = `<div>
    <button id="simulation-start" class="simulation-btn" type="button" title="Start" aria-label="Start">START</button>
<button id="simulation-stop" class="simulation-btn" type="button" title="Zoom out" aria-label="Stop" disabled="True">STOP</button>
</div>
<div>
<!--  <input type="range" id="cowbell"
         min="0" max="100" value="0" step="10">
-->
</div>`;
        this._container.onclick = this.onClick_.bind(this);
        return this._container;
    }

    onRemove()
    //========
    {
        this._container.parentNode.removeChild(this._container);
    }

    static enableStartButton(enabled)
    //===============================
    {
        const startButton = document.getElementById('simulation-start');
        const stopButton = document.getElementById('simulation-stop');
        if (enabled) {
            stopButton.setAttribute('disabled', 'True');
            startButton.removeAttribute('disabled');
        } else {
            startButton.setAttribute('disabled', 'True');
            stopButton.removeAttribute('disabled');
        }
    }

    onClick_(e)
    //=========
    {
        if        (e.target.id === 'simulation-start') {
            SimulationControl.enableStartButton(false);
            this._map.startSimulation('DATE');
        } else if (e.target.id === 'simulation-stop') {
            SimulationControl.enableStartButton(true);
            this._map.stopSimulation();
        }
    }

    processMessage(msg)
    //=================
    {
    }
}

//==============================================================================
