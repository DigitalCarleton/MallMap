// jQuery(window).load(function() {
// mallMapJs()
// });

$(document).ready(function () {
    mallMapJs()
});

function mallMapJs() {
    // Set map height to be window height minus header height.
    var windowheight = $(window).height();
    $('#map').css('height', windowheight - 54);
    //adding this so that the mall-map markers will load (most of the time; sometimes it breaks)
    // $.getScript("https://unpkg.com/leaflet.markercluster@1.3.0/dist/leaflet.markercluster.js");
    // var imported = document.createElement("script");
    // imported.src = "/cgmrdev/plugins/MallMap/views/public/javascripts/new_markercluster_src.js";
    // document.head.appendChild(imported);

    var MAP_URL_TEMPLATE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
    // var MAP_URL_TEMPLATE_HIST = 'https://allmaps.xyz/maps/0450b5c641e09dd1/{z}/{x}/{y}.png';

    // MAP_CENTER controls the default starting place
    // var MAP_CENTER = [38.8891, -77.02949];
    var MAP_CENTER = [41.9001702, 12.4698422];
    //  MAP_ZOOM controls the default zoom of the map
    var MAP_ZOOM = 14;
    var MAP_MIN_ZOOM = 14;
    var MAP_MAX_ZOOM = 17;
    // MAP_MAX_BOUNDS controls the boundaries of the map
    var MAP_MAX_BOUNDS = [[41.960039, 12.421941], [41.85927, 12.90607]];
    var LOCATE_BOUNDS = [[41.908628, 12.451941], [41.88927, 12.90607]];
    var MAX_LOCATE_METERS = 8000;

    var map;
    var historicMapLayer;
    var markers;
    var jqXhr;
    var locationMarker;
    var markerData;
    var allItems = {};

    // Set the base map layer.
    map = L.map('map', {
        center: MAP_CENTER,
        zoom: MAP_ZOOM,
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        maxBounds: MAP_MAX_BOUNDS,
        zoomControl: false
    });
    map.addLayer(L.tileLayer(MAP_URL_TEMPLATE));
    // map.addLayer(L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    //             }));
    map.addControl(L.control.zoom({ position: 'topleft' }));
    var extentControl = L.Control.extend({
        options: {
            position: 'topleft'
        },
        onAdd: function (map) {
            var llBounds = map.getBounds();
            var container = L.DomUtil.create('div', 'extentControl');
            $(container).attr('id', 'extent-control');
            $(container).css('width', '26px').css('height', '26px').css('outline', '1px black');
            $(container).addClass('extentControl-disabled')
            $(container).on('click', function () {
                map.fitBounds(llBounds);
            });
            return container;
        }
    })

    map.addControl(new extentControl());
    map.attributionControl.setPrefix('Tiles &copy; Esri');

    // Check for user's first time visiting. Wait to locate the user after displaying tooltip on the first visit.
    if (!($.cookie('myCookie'))) {
        $('#first-time').show();
        $.cookie('myCookie', 'visited', { path: '/', expires: 10000 });
    } else {
        map.locate({ watch: true });
    }

    $("#first-time button").on('click', function () {
        $('#first-time').hide();
        map.locate({ watch: true });
    });

    window.onload = function () {
        doQuery();
    };

    // Retain previous form state, if needed.
    retainFormState();

    map.on('zoomend', function () {
        if (map.getZoom() == MAP_MIN_ZOOM) {
            $('#extent-control').addClass('extentControl-disabled')
        } else {
            $('#extent-control').removeClass('extentControl-disabled')
        }
    })

    // Handle location found.
    map.on('locationfound', function (e) {
        // User within location bounds. Set the location marker.
        if (L.latLngBounds(LOCATE_BOUNDS).contains(e.latlng)) {
            launchTooltip();
            if (locationMarker) {
                // Remove the existing location marker before adding to map.
                map.removeLayer(locationMarker);
            } else {
                // Pan to location only on first locate.
                map.panTo(e.latlng);
            }
            $('#locate-button').removeClass('disabled');
            locationMarker = L.marker(e.latlng, {
                icon: L.icon({
                    iconUrl: 'plugins/MallMap/views/public/images/location.png',
                    iconSize: [50, 50]
                })
            });
            locationMarker.addTo(map).
                bindPopup("You are within " + e.accuracy / 2 + " meters from this point");
            // User outside location bounds.
        } else {
            map.stopLocate();
            $('#locate-button').addClass('disabled');
            var locateMeters = e.latlng.distanceTo(map.options.center);
            // Show out of bounds message only if within a certain distance.
            if (MAX_LOCATE_METERS > locateMeters) {
                var locateMiles = Math.ceil((locateMeters * 0.000621371) * 100) / 100;
                $('#dialog').text('You are ' + locateMiles + ' miles from the National Mall.').
                    dialog('option', 'title', 'Not Quite on the Mall').
                    dialog('open');
            }

        }
    });

    // Handle location error.
    map.on('locationerror', function () {
        map.stopLocate();
        $('#locate-button').addClass('disabled');
    });

    // Set up the dialog window.
    $('#dialog').dialog({
        autoOpen: false,
        draggable: false,
        resizable: false
    });

    // Handle the filter form.
    $('#filter-button').click(function (e) {
        e.preventDefault();

        // First close any popups
        var popupDiv = $('.leaflet-pane .leaflet-popup-pane')
        if (popupDiv.children().length > 0) {
            popupDiv.empty()
        }

        var filterButton = $(this);
        var clicks = filterButton.data('clicks');
        if (clicks) {
            filterButton.removeClass('on').
                find('.screen-reader-text').
                html('Filters');
            $('#filters').fadeToggle(200, 'linear');
        } else {
            filterButton.addClass('on').
                find('.screen-reader-text').
                html('Back to Map');
            $('#filters').fadeToggle(200, 'linear');
        }
        filterButton.data('clicks', !clicks);
    });

    $('#tour-confirm-button').click(function (e) {
        e.preventDefault();
        var filterButton = $('#filter-button');
        filterButton.removeClass('on').
            find('.screen-reader-text').
            html('Filters');
        $('#filters').fadeToggle(200, 'linear');
        var tourSelected = []
        var tourTypeCheck = $('input[name=place-type]:checked')

        if (tourTypeCheck.length) {
            tourTypeCheck.each(function () {
                tourSelected.push(markerData[this.value].walkingPath);
            });
        } else {
            var toursToPlot = Object.keys(markerData);
            console.log(toursToPlot)
            toursToPlot.forEach((ele) => {
                tourSelected.push(markerData[ele].walkingPath);
            });
        }

        let polylineGroup = L.featureGroup(tourSelected);
        let bounds = polylineGroup.getBounds();
        map.fitBounds(bounds);
    })

    // Revert form to default and display all markers.
    $('#all-button').click(function (e) {
        e.preventDefault();
        revertFormState();
    });

    // Handle locate button.
    $('#locate-button').click(function (e) {
        e.preventDefault();
        if ($(this).hasClass('disabled')) {
            return;
        }
        if (locationMarker) {
            map.removeLayer(locationMarker)
            locationMarker = null;
        }
        map.stopLocate();
        map.locate({ watch: true });
    });

    // Toggle historic map layer on and off.
    $('#toggle-map-button').click(function (e) {
        e.preventDefault();
        var toggleMapButton = $(this);
        var clicks = toggleMapButton.data('clicks');
        if (clicks) {
            toggleMapButton.addClass('on');
            toggleMapButton.find('.screen-reader-text').html('Map On');
            map.addLayer(historicMapLayer);
        } else {
            if (historicMapLayer) {
                toggleMapButton.removeClass('on');
                toggleMapButton.find('.screen-reader-text').html('Map Off');
                map.removeLayer(historicMapLayer);
            }
        }
        toggleMapButton.data('clicks', !clicks);
    });

    // Toggle map filters
    $('#filters div label').click(function () {
        var checkboxLabel = $(this);
        if (checkboxLabel.find('input[type=checkbox]').is(':checked')) {
            checkboxLabel.addClass('on');
        } else {
            checkboxLabel.removeClass('on');
        }
    });

    // Filter historic map layer.
    $('#map-coverage').change(function () {
        if (historicMapLayer) {
            removeHistoricMapLayer();
        }
        if ('0' == $('#map-coverage').val()) {
            $('#toggle-map-button').hide();
        } else {
            addHistoricMapLayer();
        }
        doFilters();
    });

    $('#map-coverage,#tour-type').on('touchstart touchend', function (event) {
        event.stopPropagation();
    });

    // Filter place type.
    $('input[name=place-type]').change(function () {
        // Handle all place types checkbox.
        var placeTypeAll = $('input[name=place-type-all]');
        if ($('input[name=place-type]:checked').length) {
            placeTypeAll.prop('checked', false).parent().removeClass('on');
        } else {
            placeTypeAll.prop('checked', true).parent().addClass('on');
        }
        doFilters();
    });

    // Handle the all place types checkbox.
    $('input[name=place-type-all]').change(function () {
        // Uncheck all place types.
        $('input[name=place-type]:checked').prop('checked', false).
            parent().removeClass('on');
        doFilters();
    });

    // Filter event type.
    $('input[name=event-type]').change(function () {
        // Handle all event types checkbox.
        var eventTypeAll = $('input[name=event-type-all]');
        if ($('input[name=event-type]:checked').length) {
            eventTypeAll.prop('checked', false).parent().removeClass('on');
        } else {
            eventTypeAll.prop('checked', true).parent().addClass('on');
        }
        doFilters();
    });

    // Handle the all event types checkbox.
    $('input[name=event-type-all]').change(function () {
        // Uncheck all event types.
        $('input[name=event-type]:checked').prop('checked', false).
            parent().removeClass('on');
        doFilters();
    });

    // Handle the info panel back button.
    $('a.back-button').click(function (e) {
        e.preventDefault();
        $('#info-panel-container').fadeToggle(200, 'linear');
    });

    function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function createCustomCSS() {
        var style = document.createElement('style')
        var css = ""
        for (const tour_id in markerData) {
            var color = markerData[tour_id]['Color']
            var rgb = hexToRgb(color)
            css += `#filters div label.label${tour_id}.on:before {
                        background-color: ${color} !important;
                    }
                    #filters div label.label${tour_id}.on {
                        background-color: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15) !important; 
                        color: ${color} !important;
                    }\n`
        }
        style.innerHTML = css;
        document.body.appendChild(style);
    }

    /*
     * Get the popup content for each item 
    */

    function getMarkerHTML(color) {
        let markerHtmlStyles = `
        background-color: ${color};
        width: 1.7rem;
        height: 1.7rem;
        display: block;
        left: -0.5rem;
        top: -0.5rem;
        position: relative;
        border-radius: 1.5rem 1.5rem 0;
        transform: rotate(45deg);`
        return markerHtmlStyles;
    }

    function popupButtonEvent(e, id, itemIDList, value) {
        e.preventDefault();
        var response = allItems[id]
        if (response == undefined) {
            $.post('mall-map/index/get-item', { id: id }, function (response) {
                allItems[id] = response
                populatePopup(itemIDList, value, response)
            })
        } else {
            populatePopup(itemIDList, value, response)
        }
    }

    function populatePopup(itemIDList, value, response) {
        var numPopup = itemIDList.findIndex((ele) => ele == response.id);

        $('.next-button').unbind("click");
        window.setTimeout(function () {
            $('.next-button').click(function (e) {
                if (numPopup + 1 == itemIDList.length) {
                    var newId = itemIDList[0]
                } else {
                    var newId = itemIDList[numPopup + 1]
                }
                popupButtonEvent(e, newId, itemIDList, value);
            })
        }, 500)

        $('.prev-button').unbind("click");
        window.setTimeout(function () {
            $('.prev-button').click(function (e) {
                if (numPopup - 1 == -1) {
                    var newId = itemIDList[itemIDList.length - 1]
                } else {
                    var newId = itemIDList[numPopup - 1]
                }
                popupButtonEvent(e, newId, itemIDList, value);
            })
        }, 500)

        document.getElementById("info-panel-name").innerHTML = value["Tour Name"] + ` #${numPopup + 1}`;
        var content = $('#info-panel-content');
        content.empty();

        var infoContent = ""
        var leftContent = "";
        var rightContent = "";

        leftContent += response.fullsize;
        infoContent += '<div class = "image-container">' + leftContent + '</div>';

        rightContent += '<h2 class = info-panel-title>' + response.title + '</h2>'
        if (response.abstract) {
            rightContent += '<p>' + response.abstract + '</p>';
        } else if (response.description) {
            rightContent += '<p>' + response.description + '</p>';
        } else {
            rightContent += '<p>No descriptions available.</p>';
        }
        rightContent += '<p><a href="' + response.url + '" class="button" target="_blank">See Full Details</a></p>';
        infoContent += '<div class = "content-container"> <div class ="article">' + rightContent + '</div></div>';

        content.append('<div class = "info-content">' + infoContent + '</div>')
    }

    function featureOnclickAction(response, layer, marker, itemIDList, value) {
        var popupContent = '<h3>' + response.title + '</h3>';
        if (response.thumbnail) {
            popupContent += '<a href="#" class="open-info-panel">' + response.thumbnail + '</a><br/>';
        }
        popupContent += '<a href="#" class="open-info-panel button">view more info</a>';
        if (!layer.getPopup()) {
            marker.bindPopup(popupContent, { maxWidth: 200, offset: L.point(0, -40) }).openPopup();
        }

        window.setTimeout(function () {
            layer.getPopup().update()
            $('.open-info-panel').click(function (e) {
                e.preventDefault();
                $('#info-panel-container').fadeToggle(200, 'linear');
                $('#toggle-map-button + .back-button').show();
                marker.closePopup();
            });
        }, 500);

        // Populate the item info panel.
        populatePopup(itemIDList, value, response, allItems);
    }

    function doQuery() {
        const markerFontHtmlStyles = `
        transform: rotate(-45deg);
        color:white;
        text-align: center;
        padding: 0.2rem 0 0.18rem 0;
        font-size: 15px;
        `

        // correctly formats coordinates as [lat, long] (API returns [long, lat])
        function orderCoords(path) {
            var directions = [];
            for (var i = 0; i < path.length; i++) {
                directions.push([path[i][1], path[i][0]]);
            }
            return directions;
        }

        async function getOverallPath(points, key) {
            var pointsParam = []
            points.forEach(ele => {
                pointsParam.push([ele.lng, ele.lat])
            })
            url = "https://api.openrouteservice.org/v2/directions/foot-walking/geojson"
            const response = await fetch(url, {
                method: "POST", // *GET, POST, PUT, DELETE, etc.
                headers: {
                    'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
                    "Content-Type": "application/json",
                    'Authorization': key
                    // 'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `{"coordinates": ${JSON.stringify(pointsParam)}}`, // body data type must match "Content-Type" header
            })
            return response.json();
        }

        var key = "5b3ce3597851110001cf62489dde4c6690bc423bb86bd99921c5da77";
        var url;
        var itemArray = []
        var tourToItem = {}
        jqXhr = $.post('mall-map/index/query', function (response) {
            markerData = response;
            dataArray = Object.entries(markerData)
            for (const tour in markerData) {
                itemArray = itemArray.concat(markerData[tour]['Data']['features'])
            }
            let requests = dataArray.map(([tourId, value]) => {
                return new Promise((resolve) => {
                    var numMarker = 1;
                    var response = value["Data"];
                    var itemIDList = [];

                    response.features.forEach(ele => {
                        itemIDList.push(ele.properties.id)
                    })
                    tourToItem[tourId] = itemIDList;
                    var geoJsonLayer = L.geoJson(response.features, {
                        // adds the correct number to each marker based on order of tour
                        pointToLayer: function (feature, latlng) {
                            myCustomColour = feature.properties["marker-color"];
                            var numberIcon = L.divIcon({
                                className: "my-custom-pin",
                                iconSize: [25, 41],
                                iconAnchor: [12, 40],
                                popupAnchor: [0, -5],
                                html: `<span style="${getMarkerHTML(feature.properties["marker-color"])}" > <p style="${markerFontHtmlStyles}"> ${numMarker} </p> </spam>`
                            });
                            // numberIcon.style.backgroundColor = feature.properties["marker-color"];
                            numMarker++;
                            return new L.marker(latlng, { icon: numberIcon });
                        },
                        onEachFeature: function (feature, layer) {
                            layer.on('click', function (e) {
                                // center click location
                                map.flyTo(e.latlng, 16);
                                // Close the filerting
                                var filterButton = $('filter-button');
                                filterButton.removeClass('on').
                                    find('.screen-reader-text').
                                    html('Filters');
                                $('#filters').fadeOut(200, 'linear');

                                var marker = this;
                                response = allItems[feature.properties.id]
                                if (response == undefined) {
                                    $.post('mall-map/index/get-item', { id: feature.properties.id }, function (response) {
                                        allItems[feature.properties.id] = response;
                                        featureOnclickAction(response, layer, marker, itemIDList, value);
                                    })
                                } else {
                                    featureOnclickAction(response, layer, marker, itemIDList, value);
                                }
                            });

                        }
                    });
                    markerData[tourId].geoJson = geoJsonLayer;
                    var walkingPath = [];
                    var json_content = response.features;
                    var pointList = [];
                    for (var i = 0; i < json_content.length; i++) {
                        lat = json_content[i].geometry.coordinates[1];
                        lng = json_content[i].geometry.coordinates[0];
                        var point = new L.LatLng(lat, lng);
                        pointList[i] = point;
                    }
                    getOverallPath(pointList, key).then((data) => {
                        var path = data["features"][0]["geometry"]["coordinates"];
                        path = orderCoords(path);
                        for (var p of path) {
                            walkingPath.push(p);
                        }
                        var tourPolyline = new L.Polyline(walkingPath, {
                            color: value["Color"],
                            weight: 3,
                            opacity: 1,
                            smoothFactor: 1
                        });
                        markerData[tourId].walkingPath = tourPolyline;
                        resolve()
                    });
                });
            })
            Promise.all(requests).then(() => {
                createCustomCSS();
                doFilters();
            });
        });
    }

    /*
     * Filter markers.
     *
     * This must be called on every form change.
     */
    function doFilters() {
        // Remove the current markers.
        if (markers) {
            map.removeLayer(markers);
        }

        var mapCoverage = $('#map-coverage');
        var tourTypeCheck = $('input[name=place-type]:checked')

        var toursToPlot = [];
        var mapToPlot;
        // Handle each filter
        if ('0' != mapCoverage.val()) {
            mapToPlot = mapCoverage.val();
        }

        if (tourTypeCheck.length) {
            tourTypeCheck.each(function () {
                toursToPlot.push(this.value);
            });
        } else {
            toursToPlot = Object.keys(markerData);
        }

        var pathToPlot = [];
        var markerLayers = [];
        var numMarkers = 0;

        // handle the GeoJSON response, and add markers.
        toursToPlot.forEach(ele => {
            numMarkers += markerData[ele].Data.features.length;
            markerLayers.push(markerData[ele].geoJson);
            pathToPlot.push(markerData[ele].walkingPath);
        });
        //response is an array of coordinate;
        var item = (1 == numMarkers) ? 'item' : 'items';
        $('#marker-count').text(numMarkers + " " + item);

        try {
            markers = new L.layerGroup();
        }
        catch (err) {
            $.getScript("https://unpkg.com/leaflet.markercluster@1.3.0/dist/leaflet.markercluster.js");
            // var imported = document.createElement("script");
            // imported.src = "/cgmrdev/plugins/MallMap/views/public/javascripts/new_markercluster_src.js";
            // document.head.appendChild(imported);
        }

        markerLayers.forEach(ele => {
            markers.addLayer(ele);
        })
        pathToPlot.forEach(ele => {
            ele.addTo(markers);
        })
        map.addLayer(markers);
    }

    /*
     * Add the historic map layer.
     */
    function addHistoricMapLayer() {
        // Get the historic map data
        var getData = { 'text': $('#map-coverage').val() };
        $.get('mall-map/index/historic-map-data', getData, function (response) {
            historicMapLayer = L.tileLayer(
                response.url,
                { tms: true, opacity: 1.00 }
            );
            map.addLayer(historicMapLayer);
            $('#toggle-map-button').show();

            // Set the map title as the map attribution prefix.
            map.attributionControl.setPrefix(response.title);
        });
    }

    /*
     * Remove the historic map layer.
     */
    function removeHistoricMapLayer() {
        $('#toggle-map-button').data('clicks', false).hide();
        map.removeLayer(historicMapLayer);
        map.attributionControl.setPrefix('');
    }

    /*
     * Revert to default (original) form state.
     */
    function revertFormState() {
        if (historicMapLayer) {
            removeHistoricMapLayer();
        }

        $('#map-coverage').val('0');
        $('#tour-type').val('0');

        $('#place-type-div').hide({ duration: 'fast' });
        $('input[name=place-type-all]').prop('checked', true).
            parent().addClass('on');
        $('input[name=place-type]:checked').prop('checked', false).
            parent().removeClass('on');

        $('#event-type-div').hide({ duration: 'fast' });
        $('input[name=event-type-all]').prop('checked', true).
            parent().addClass('on');
        $('input[name=event-type]:checked').prop('checked', false).
            parent().removeClass('on');

        doFilters();
    }

    /*
     * Retain previous form state.
     *
     * Acts on the assumption that all browsers will preserve the form state
     * when navigating back to the map from another page.
     */
    function retainFormState() {
        // if ('0' != $('#map-coverage').val()) {
        //     addHistoricMapLayer();
        // }
        if ('Place' == $('#tour-type').find(':selected').text()) {
            var placeTypes = $('input[name=place-type]:checked');
            if (placeTypes.length) {
                $('input[name=place-type-all]').parent().removeClass('on');
                placeTypes.parent().addClass('on');
            }
            $('#place-type-div').show({ duration: 'fast' });
        }
        if ('Event' == $('#tour-type').find(':selected').text()) {
            var eventTypes = $('input[name=event-type]:checked');
            if (eventTypes.length) {
                $('input[name=event-type-all]').parent().removeClass('on');
                eventTypes.parent().addClass('on');
            }
            $('#event-type-div').show({ duration: 'fast' });
        }
    }

    var debugTimestamp;
    function start() {
        debugTimestamp = new Date().getTime();
    }
    function stop() {
        console.log((new Date().getTime() / 1000) - (debugTimestamp / 1000));
    }
}
