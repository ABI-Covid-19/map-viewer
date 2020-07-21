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
import 'mapbox-gl/dist/mapbox-gl.css';

import io from 'socket.io-client';

//==============================================================================

// Load our stylesheet last so we can overide styling rules

import '../static/viewer.css';

//==============================================================================

import {SimulationControl} from './controls.js';
import {SimulationData} from './simulation.js';
import {loadJSON, serverUrl} from './server.js';

//==============================================================================

class Map
{
   /**
    * Maps are not created directly but instead are created and loaded by
    * :meth:`MapManager.LoadMap`.
    */
    constructor(container, style, options, resolve)
    {
        this._id = options.id;
        this._options = options;
        this._resolve = resolve;
        this._popup = null;
        this._buildingGeometry = null;
        this._buildingLngLat = null;


/*
        // Set base of source URLs in map's style

        for (const [id, source] of Object.entries(style.sources)) {
            if (source.url) {
                source.url = sourceUrl(this._id, source.url);
            }
            if (source.tiles) {
                const tiles = [];
                for (const tileUrl of source.tiles) {
                    tiles.push(sourceUrl(this._id, tileUrl));
                }
                source.tiles = tiles;
            }
        }
*/
        // Set options for the Mapbox map

        const mapboxOptions = {
            style: style,
            container: container,
            attribution: true
        };

        if (options.debug === true) {
            mapboxOptions.hash = true;
        }
        if ('max-zoom' in options) {
            mapboxOptions.maxZoom = options['max-zoom'];
        }
        if ('min-zoom' in options) {
            mapboxOptions.minZoom = options['min-zoom'];
        }
        if ('zoom' in options) {
            mapboxOptions.zoom = options['zoom'];
        }

        // Create the map

        this._map = new mapboxgl.Map(mapboxOptions);

        // Show attribution

        this._map.addControl(new mapboxgl.AttributionControl({
            customAttribution: 'Map data © OpenStreetMap contributors, Map layer by Esri'
        }));

        // Show tile boundaries if debugging

        if (options.debug === true) {
            this._map.showTileBoundaries = true;
        }

        // Don't wrap around at +/-180 degrees

        //this._map.setRenderWorldCopies(false);

        // this._map.setMaxBounds(options.bounds)

        /*
         *    A `style` defines sources and layers...
         *
         *    addSource(id, sourceObject)
         *    addLayer(layerObject)
         *
         *
         */

        // Do we want a fullscreen control?

        if (options.fullscreenControl === true) {
            this._map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
        }

        // Disable map rotation

        this._map.dragRotate.disable();
        this._map.touchZoomRotate.disableRotation();

        // Add navigation controls if option set

        if (options.navigationControl === true) {
            this._map.addControl(new mapboxgl.NavigationControl({showCompass: false}), 'bottom-right');
        }

        // Handle mouse click events

        this._map.on('click', this.mouseClickEvent_.bind(this));

        // Optionally show feature info as tooltip

        if (options.featureInfo) {
            this._map.on('mousemove', e => this.mouseMoveEvent_(e));
        }

        // Establish a channel to the server on which to receive simulation data

        this._socket = io('http://localhost:4329', {
            transports: ['websocket', 'polling', 'flashsocket']
        });
        this._socket.on('connect', skt => {
            console.log('Connected!!');
        });
        this._socket.on('msg', this.socketMessage_.bind(this));

        // Add a control to manage running simulations

        this._simulationControl = new SimulationControl(this);
        this._map.addControl(this._simulationControl);

        this._simulationData = new SimulationData();

        // Wait until all sources have loaded

        this._map.on('load', this.finalise_.bind(this));
    }

    async finalise_()
    //===============
    {

        this._map.addSource('simulation', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        // Map sources have loaded so add style layers

        this._map.addLayer({
            'id': 'simulation-line',
            'type': 'line',
            'source': 'simulation',
            'filter': ['==', '$type', 'LineString'],
            'paint': {
                'line-width': 2,
                'line-color': '#CCC'
            }
        });
        // Status: S, E, I, R, D for susceptible, exposed, infected, recovered, dead
        this._map.addLayer({
            'id': 'simulation-point',
            'type': 'circle',
            'source': 'simulation',
            'filter': ['==', '$type', 'Point'],
            'paint': {
                'circle-radius': 5,
                'circle-color': [
                    'case',
                    ['==', ['get', 'status'], 'S'], 'blue',
                    ['==', ['get', 'status'], 'E'], 'yellow',
                    ['==', ['get', 'status'], 'I'], 'red',
                    ['==', ['get', 'status'], 'R'], 'green',
                    ['==', ['get', 'status'], 'D'], 'black',
                    'pink'
                ],
                'circle-opacity': ['/', 1, ['+', ['get', 'order'], 1]]
            }
        });

        // All loaded...

        this._resolve(this);
    }

    fitBounds()
    //=========
    {
        if ('bounds' in this._options) {
            this._map.fitBounds(this._options['bounds']);
        }
    }

    resize()
    //======
    {
        // Resize the map to fit its container

        this._map.resize();
    }

    removePopup()
    //===========
    {
        if (this._popup) {
            this._popup.remove();
            this._popup = null;
        }
    }

    showPopup(elementList, position)
    //==============================
    {
        if (elementList.length > 0) {
            if (this._popup === null) {
                this._popup = new mapboxgl.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    maxWidth: 'none'
                });
                this._popup.addTo(this._map);
            }
            this._popup
                .setLngLat(position)
                .setHTML(`<div id="info-control-info">${elementList.join('\n')}</div>`);
        } else {
            this.removePopup();
        }
    }

    mouseClickEvent_(event)
    //=====================
    {
        console.log('Clicked at ' + event.lngLat);
        this.sendMessage('control', {
            'type': 'mouse',
            'action': 'click',
            'data': event.lngLat
        });
    }

    mouseMoveEvent_(event)
    //====================
    {
        // Get all the features at the current point if control is active
        // otherwise just the highlighted ones

        const features = this._map.queryRenderedFeatures(event.point);
        if (features.length === 0) {
            return;
        }

        this._buildingGeometry = null;
        if (this._options.debug) {
            // See example at https://docs.mapbox.com/mapbox-gl-js/example/queryrenderedfeatures/

            // Limit the number of properties we're displaying for
            // legibility and performance
            const displayProperties = [
                'type',
                'properties',
                'id',
                'layer',
                'source',
                'sourceLayer',
                'state'
            ];

            // Do we filter for smallest properties.area (except lines have area == 0)
            // with lines having precedence... ??

            const displayFeatures = features//.filter(f => f.source === 'simulation')
                                            .map(feat => {
                const displayFeat = {};
                displayProperties.forEach(prop => {
                    displayFeat[prop] = feat[prop];
                });
                return displayFeat;
            });

            if (displayFeatures.length > 0) {
                const html = `<pre class="feature-info">${JSON.stringify(
                        displayFeatures,
                        null,
                        2
                    )}</pre>`;
                // <<<<<<<< Show in scrollable sidebar, not as tooltip <<<<<<<
            }
        }

        const featureHtml = features.map(feat => {
            const htmlList = [];
            /*
            if (feat.source === 'simulation') {
                if ('properties' in feat) {
                    for (const [key, value] of Object.entries(feat['properties'])) {
                        if (!key.startsWith('_')) {
                            htmlList.push(`<span class="info-name">${key}:</span>`);
                            htmlList.push(`<span class="info-value">${value}</span>`);
                        }
                    }
                }
            } else
            */
            if (feat.source === 'esri' && feat.sourceLayer === 'building') {
                this._buildingGeometry = feat.geometry;
                this._buildingLngLat = event.lngLat;
            }
            return htmlList.join('');
        }).filter(html => html !== '');

        if (this._buildingGeometry === null) {
            this.showPopup(featureHtml, event.lngLat);
        }
    }

    showBuildingOccupants_()
    //======================
    {
        if (this._buildingGeometry !== null) {
            const counts = this._simulationData.actorsInBuildingAtIndex(
                                this._stepNumber,
                                this._buildingGeometry);
            if (counts.building > 0) {    // > 1 ??  <<<<<<<<<<<<<<<<<<<<<<<<<<
                const htmlList = [];
                for (const [key, value] of Object.entries(counts)) {
                    if (!key.startsWith('_') && key !== 'building' && value > 0) {
                        htmlList.push(`<span class="info-name">${key}:</span>`);
                        htmlList.push(`<span class="info-value">${value}</span>`);
                    }
                this.showPopup(htmlList, this._buildingLngLat);
                }
            }
        }
    }

    socketMessage_(msg)
    //=================
    {
        if        (msg.type === 'metadata') {
            if (msg.data.type === 'simulation') {
                this.startSimulationAnimation(msg.data);
            }
        } else if (msg.type === 'data') {
            const msgData = msg.data;
            if (msgData.type === 'geojson') {
                const points = JSON.parse(msgData.data);
                this._map.getSource('simulation').setData(points);
            } else if (msgData.type === 'simulation') {
                const time = msgData.timestamp;
                this._simulationData.addTimeStep(time, msgData.data);
            }
        } else if (msg.type == 'control') {
            if (msg.data.type === 'simulation') {
                this._simulationControl.processMessage(msg.data.action);
            }
        }
    }

    sendMessage(type, data)
    //=====================
    {
        this._socket.emit('msg', {
            'type': type,
            'data': data
        });
    }

    startSimulation(startDate)
    //========================
    {
        this.sendMessage('control', {
            'type': 'simulation',
            'action': 'start',
            'data': startDate
        });
    }

    stopSimulation()
    //==============
    {
        this.sendMessage('control', {
            'type': 'simulation',
            'action': 'stop'
        });
    }

    startSimulationAnimation(metadata)
    //================================
    {
        this._stepStartTimestamp = -1;
        this._stepNumber = 0;
        this._stepTotal = metadata['length'];
        window.requestAnimationFrame(this.simulationStep.bind(this));
    }

    simulationStep(timestamp)
    //=======================
    {
        if (this._stepStartTimestamp === -1) {
            this._stepStartTimestamp = timestamp;
        }
        const elapsed = timestamp - this._stepStartTimestamp;

        const ANIMATION_PERIOD = 60000;  // 60 seconds  **** From slider <<<<<<<<<<<<<<<

// Dynamically show number/status in building geometry at time/step

        if (elapsed >= this._stepNumber*ANIMATION_PERIOD/this._stepTotal) {
            this._stepNumber = Math.floor(0.5 + elapsed*this._stepTotal/ANIMATION_PERIOD);
            this._map.getSource('simulation').setData(this._simulationData.featuresAtIndex(this._stepNumber));
            this.showBuildingOccupants_();
            this._stepNumber += 1;
        }
        if (elapsed < ANIMATION_PERIOD) {
            window.requestAnimationFrame(this.simulationStep.bind(this));
        } else {                         // Stop the animation
            if (this._stepNumber < (this._stepTotal - 1)) {
                this._stepNumber = this._stepTotal - 1;
                this._map.getSource('simulation').setData(this._simulationData.featuresAtIndex(this._stepNumber));
                this.showBuildingOccupants_();
            }
            SimulationControl.enableStartButton(true);
        }
    }

}

//==============================================================================

/**
* Load and display a COVID-19 map.
*
* @arg container {string} The id of the HTML container in which to display the map.
* @arg mapId {string|Object} A string identifying the map to load.
* @arg callback {function(string, Object)} A callback function, invoked when events occur with the map. The
*                                          first parameter gives the type of event, the second provides
*                                          details about the feature(s) the event is for.
* @arg options {Object} Configurable options for the map.
* @arg options.debug {boolean} Enable debugging mode.
* @arg options.fullscreenControl {boolean} Add a ``Show full screen`` button to the map.
* @arg options.featureInfo {boolean} Show information about features as a tooltip. The tooltip is active
*                                    on highlighted features and, for non-highlighted features, when the
*                                    ``info`` control is enabled. More details are shown in debug mode.
* @arg options.navigationControl {boolean} Add navigation controls (zoom buttons) to the map.
* @arg options.searchable {boolean} Add a control to search for features on a map.
*/
export function loadMap(container, mapId, options={})
//===================================================
{
    return new Promise(async(resolve, reject) => {
        try {
/*
            // Load the map's index file (its default options)

            const mapOptions = await loadJSON(`/${mapId}/`);

            if (mapId !== mapOptions.id) {
                throw new Error(`Map '${mapId}' has wrong ID in index`);
            }
*/
            const mapOptions = {};

            // Overide default options with local values

            for (const [name, value] of Object.entries(options)) {
                mapOptions[name] = value;
            }

            // Get the map's style file

            const style = await loadJSON(`/${mapId}/style`);

            // Make sure the style has glyphs defined

            if (!('glyphs' in style)) {
                style.glyphs = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf';
            }

            // Display the map

            return new Map(container, style, mapOptions, resolve);

        } catch (err) {
            reject(err);
        }
    });
}

//==============================================================================
