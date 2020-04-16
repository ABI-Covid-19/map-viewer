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

//==============================================================================

// Load our stylesheet last so we can overide styling rules

import '../static/viewer.css';

//==============================================================================

import {loadJSON, serverUrl, sourceUrl} from './server.js';

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

        // Set options for the Mapbox map

        const mapboxOptions = {
            style: style,
            container: container
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
            //this._map.addControl(new mapboxgl.NavigationControl({showCompass: false}), 'bottom-right');
            this._map.addControl(new mapboxgl.NavigationControl({showCompass: true}), 'bottom-right');
        }

        if (options.featureInfo) {
            // Show feature info as tooltip

            this._map.on('mousemove', e => this.mouseMove_(e));
        }

        // Wait until all sources have loaded

        this._map.on('load', this.finalise_.bind(this));
    }

    async finalise_()
    //===============
    {
        // The map has loaded so resolve the caller's promise

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

    removePopup_()
    //============
    {
        if (this._popup) {
            this._popup.remove();
            this._popup = null;
        }
    }

    mouseMove_(e)
    //===========
    {
        this.removePopup_();

        // Get all the features at the current point if control is active
        // otherwise just the highlighted ones

        const features = this._map.queryRenderedFeatures(e.point);
        if (features.length === 0) {
            return;
        }

        let html = null;

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

            const displayFeatures = features.map(feat => {
                const displayFeat = {};
                displayProperties.forEach(prop => {
                    displayFeat[prop] = feat[prop];
                });
                return displayFeat;
            });

            html = `<pre class="feature-info">${JSON.stringify(
                    displayFeatures,
                    null,
                    2
                )}</pre>`;
        } else {
            const featureHtml = features.map(feat => {
                const htmlList = [];
                if ('properties' in feat) {
                    for (const [key, value] of Object.entries(feat['properties'])) {
                        if (!key.startsWith('_')) {
                            htmlList.push(`<span class="info-name">${key}:</span>`);
                            htmlList.push(`<span class="info-value">${value}</span>`);
                        }
                    }
                }
                if (htmlList.length === 0) {
                    return '';
                } else {
                    return htmlList.join('');
                }
            }).filter(html => html !== '');

            if (featureHtml.length === 0) {
                return;
            }

            html = `<div id="info-control-info">${featureHtml.join('\n')}</div>`;
        }

        // Show as a tooltip

        this._popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: 'none'
        });
        this._popup
            .setLngLat(e.lngLat)
            .setHTML(html)
            .addTo(this._map);
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
