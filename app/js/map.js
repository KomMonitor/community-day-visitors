var mapContainerNodeId = "mapContainer";
var linkToCsvFile = "./app/resources/TN.csv";

var linkToJsonFile = "./app/resources/gemeinden.json.geojson";

var linkToJsonFile_centroids = "./app/resources/gemeinden_centroids.json.geojson";

const layerName_gemeinden = "Gemeinden Deutschlands";
const property_gn = "GEN";

const property_city = "Stadt";

const destination_bochum = [51.447746, 7.269063];

var overlayLayersArray = [];

var map;
var layerControl;

function initControls() {

    if (map) {
        // zoom control as default

        // attribution control - static suffix
        map.attributionControl.addAttribution("Hochschule Bochum");

        // scale control
        L.control.scale(
            { maxWidth: 500, metric: true, imperial: false }
        ).addTo(map);

        // layerControl
        var baseLayers = {};
        var overlayLayers = {};
        layerControl = L.control.layers(baseLayers, overlayLayers);
        layerControl.addTo(map);
    }

}

function initBackgroundLayers() {

    if (map && layerControl) {
        // specify all background WMS layers
        // only OSM as active layer

        // start layer

        // https://b.basemaps.cartocdn.com/light_all/14/8521/5445.png?

        var carto_positron_layer =
            L.tileLayer('https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                { attribution: 'CartoDB Positron' }).addTo(map);

        // var osmLayer_tiled =
        //     L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        //         { attribution: 'OSMTiles' }).addTo(map);

        // add baseLayers to Base Layers in layer control
        // layerControl.addBaseLayer(osmLayer_tiled, "Open Street Map");
        layerControl.addBaseLayer(carto_positron_layer, "CartoDB Positron");
    }
}

function onEachFeature(feature, layer) {
    if (feature.properties) {
        let html = "<div class='featurePropertyPopupHeader'><b>" + feature.properties[property_gn] + "</b></div><br/><div class='featurePropertyPopupContent'>";

        layer.bindPopup(html);
    }
    else {
        layer.bindPopup("No properties found");
    }
}

function addLeafletOverlay(geoJSON, title, styleColor, transparency) {
    if (map && layerControl) {

        let layer = L.geoJSON(geoJSON, {
            style: function (feature) {
                return {
                    // color: styleColor,
                    color: "black",
                    fillColor: styleColor,
                    fillOpacity: 1 - transparency,
                    opacity: 1
                };
            },
            onEachFeature: onEachFeature,
        }).addTo(map);

        layerControl.addOverlay(layer, title);
        overlayLayersArray.push(layer);

        map.fitBounds(layer.getBounds());
        // map.setMaxBounds(layer.getBounds());
    }
}


function loadLayers(geoJSON) {
    let geoJSON_gemeinden = JSON.parse(JSON.stringify(geoJSON));

    // addAll features
    addLeafletOverlay(geoJSON_gemeinden, layerName_gemeinden, "#919191", 0.4);

}

function clearOverlays() {
    for (const layer of overlayLayersArray) {
        layerControl.removeLayer(layer);
        map.removeLayer(layer);
    }
}

function initOverlays() {
    if (map && layerControl) {
        // specify all overlay layers

        clearOverlays();

        fetch(linkToJsonFile)
            .then((response) => response.json())
            .then((data) => {

                loadLayers(data);
            }
            )
            .catch((error) => {
                console.error('Error:', error);
            });
    }
}

function initMap() {
    // map = L.map(mapContainerNodeId).setView([51.461372, 7.2418863], 6);
    map = L.map(mapContainerNodeId, {
        center: [51.3149725, 8.3905754],
        zoom: 8,
        zoomDelta: 0.5,
        zoomSnap: 0.5,
        minZoom: 8,
        maxZoom: 13,
    });

    initControls();

    initBackgroundLayers();

    // initOverlays();
}

async function createGemeindenCountMap(results) {
    let map = new Map();


    return await fetch(linkToJsonFile_centroids)
        .then((response) => response.json())
        .then((data) => {
            // iterate over gemeinden entries and init map
            for (const gemeinde of data.features) {
                map.set(gemeinde.properties[property_gn].toLowerCase(), {
                    count: 0,
                    latLng: [gemeinde.geometry.coordinates[1], gemeinde.geometry.coordinates[0]]
                });
            }

            // iterate over csv entries and increment count attribute
            for (const visitor of results.data) {
                let city = visitor[property_city].toLowerCase();

                let mapEntry = map.get(city);
                if (mapEntry) {
                    mapEntry.count++;

                    map.set(city, mapEntry);
                }
                else{
                    console.log("not identified in map: " + city);
                }


                // for (const gemeinde of data.features) {
                //     let gemeindename = gemeinde.properties[property_gn].toLowerCase();
                //     if (city.includes(gemeindename) ){
                //         let mapEntry = map.get(gemeindename);
                //         mapEntry.count ++;

                //         map.set(gemeindename, mapEntry);
                //     }
                // }
            }

            // filter out all gemeinden where count=0
            for (let [key, value] of map) {
                if (value.count == 0)
                    map.delete(key);
            }

            return map;
        }
        )
        .catch((error) => {
            console.error('Error:', error);
        });

}

async function addSwoopyLayer(results) {

    let gemeinden_map = await createGemeindenCountMap(results);

    let swoopyFeatures = [];

    for (let [key, value] of gemeinden_map) {

        if (value.count > 0) {
            let swoopyFeature = L.swoopyArrow(value.latLng, destination_bochum, {
                // label: '' + key,
                labelFontSize: 16,
                labelColor: "#f59542",
                weight: value.count,
                hideArrowHead: true,
                color: "#f59542",
                // iconAnchor: [20, 10],
                iconAnchor: [10, 10],
                iconSize: [100, 50]
            })

            swoopyFeatures.push(swoopyFeature);
        }
    }

    let featureGroup = L.featureGroup(swoopyFeatures);

    featureGroup.addTo(map);
    layerControl.addOverlay(featureGroup, "Besucher");
    overlayLayersArray.push(featureGroup);
}

function parseCSV() {
    Papa.parse("./app/resources/TN.csv", {
        download: true,
        delimiter: "",	// auto-detect
        newline: "",	// auto-detect
        quoteChar: '"',
        escapeChar: '"',
        header: true,
        transformHeader: undefined,
        dynamicTyping: false,
        preview: 0,
        encoding: "",
        worker: false,
        comments: false,
        step: undefined,
        complete: async function (results, file) {
            console.log("Parsing complete:", results, file);
            await addSwoopyLayer(results);
        },
        error: function (error, file) {
            console.error("Parsing error:", error, file);
        },
        downloadRequestHeaders: undefined,
        downloadRequestBody: undefined,
        skipEmptyLines: false,
        chunk: undefined,
        chunkSize: undefined,
        fastMode: undefined,
        beforeFirstChunk: undefined,
        withCredentials: undefined,
        transform: undefined,
    })
}

function onDomLoaded() {

    initMap();

    parseCSV();
}

document.addEventListener("DOMContentLoaded", onDomLoaded);