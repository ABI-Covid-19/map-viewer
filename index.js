import { loadMap } from './src/viewer';

window.onload = function() {
//    const nzMap = loadMap('map1', 'new-zealand', {debug: true, featureInfo: false});
    const nzMap = loadMap('map1', 'esri', {debug: false, featureInfo: true, navigationControl: true});

    // NZ "bounds": [162.096, -48.77, 179.8167, -32.667],
};


// Bad...
// https://maps.geoapify.com/v1/styles/klokantech-basic/style.json?apiKey=1c31efa75aea48849c861dce07a3f93d

// Good...
// https://maps.geoapify.com/v1/styles/osm-carto/style.json?apiKey=1c31efa75aea48849c861dce07a3f93d
//
//
// https://basemaps.arcgis.com/arcgis/rest/services/OpenStreetMap_GCS_v2/VectorTileServer/tile/10/361/1010.pbf
//
// https://basemaps.arcgis.com/arcgis/rest/services/OpenStreetMap_v2/VectorTileServer
