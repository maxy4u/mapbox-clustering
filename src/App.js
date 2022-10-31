import React, { useState, useRef, useCallback, useMemo } from "react";
import useSwr from "swr";
import ReactMapGL, {
  Layer,
  Source,
  NavigationControl,
  Popup,
  MapProvider
} from "react-map-gl";
import useSupercluster from "use-supercluster";
import "./App.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { ReactComponent as TruckLogo } from "./truck.svg";
import { renderToStaticMarkup } from "react-dom/server";
import CustomOverlay from "./CustomOverlay";

const crimeCategories = [
  "violent-crime",
  "burglary",
  "anti-social-behaviour",
  "other-theft",
  "criminal-damage-arson",
  "vehicle-crime",
  "public-order",
  "shoplifting",
  "theft-from-the-person",
  "drugs",
  "robbery",
  "bicycle-theft"
];

export function svgToDataUrl(svgAsPath, svgAsJSX) {
  return new Promise((resolve) => {
    const image = new Image(20, 20);
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (e) => {
      throw new Error("SVG conversion failed");
    });
    const svgString = encodeURIComponent(renderToStaticMarkup(svgAsJSX));
    const dataUri = `data:image/svg+xml;charset=utf-8,${svgString}`;
    const src = svgAsJSX ? dataUri : svgAsPath;
    image.src = src;
  });
}

const initialViewState = {
  latitude: 40.67,
  longitude: -103.59,
  zoom: 3
};
const interactiveLayerIds = ["clusters", "marker"];
const fetcher = (...args) => fetch(...args).then((response) => response.json());
const MAPBOX_TOKEN =
  "pk.eyJ1IjoiZ2F1cmF2a2h1cmFuYSIsImEiOiJjbDg0b21iZzEwOHc3M29wZG4xbmlxNzN2In0.JaDwGU4-nidX9WstOTOQcg";
const circleLayer = {
  id: "clusters",
  type: "circle",
  source: "assets-source",
  sourceId: "assets-source",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": [
      "step",
      ["get", "point_count"],
      "#51bbd6",
      100,
      "#f1f075",
      750,
      "#f28cb1"
    ],
    "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40]
  }
};

const pointsLayer = {
  id: "clusters-count",
  type: "symbol",
  source: "assets-source",
  sourceId: "assets-source",
  filter: ["has", "point_count"],
  layout: {
    "text-field": [
      "format",
      ["get", "point_count"],
      {
        "font-scale": 1.0
      }
    ]
  }
};

export const markerLayer = {
  id: "marker",
  type: "circle",
  //type: "symbol",
  source: "assets-source",
  sourceId: "assets-source",
  filter: [
    "in",
    "category",
    "burglary",
    "anti-social-behaviour",
    "other-theft",
    "criminal-damage-arson",
    "vehicle-crime",
    "public-order",
    "shoplifting",
    "theft-from-the-person",
    "drugs",
    "robbery",
    "bicycle-theft"
  ],
  // layout: {
  //   "icon-image": "truck", // reference the image
  //   "icon-size": 1
  // },
  paint: {
    "circle-color": [
      "match", // Use the 'match' expression: https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-match
      ["get", "category"], // Use the result 'STORE_TYPE' property
      "drugs",
      "#FF8C00",
      "burglary",
      "#FF8C00",
      "anti-social-behaviour",
      "#FF8C00",
      "other-theft",
      "#9ACD32",
      "criminal-damage-arson",
      "#008000",
      "vehicle-crime",
      "#008000",
      "public-order",
      "#008000",
      "shoplifting",
      "#008000",
      "theft-from-the-person",
      "#008000",
      "#FF0000" // any other store type
    ],
    "circle-radius": 20
  }
};

const violentCrimeLayer = {
  id: "Crime-Violent",
  type: "symbol",
  //type: "circle",
  source: "assets-source",
  sourceId: "assets-source",
  filter: ["==", "category", "violent-crime"],
  layout: {
    "icon-image": "pulsing-dot"
  }
  // paint: {
  //   "circle-color": "#FFA500",
  //   "circle-radius": 20
  // }
};

export default function App() {
  const [popup, setPopup] = useState(null);
  const [viewport, setViewport] = useState({
    latitude: 52.6376,
    longitude: -1.135171,
    width: "100vw",
    height: "100vh",
    zoom: 6
  });
  const mapRef = useRef();

  const onMapLoad = useCallback(() => {
    const map = mapRef.current.getMap();
    const size = 200;

    // This implements `StyleImageInterface`
    // to draw a pulsing dot icon on the map.
    const pulsingDot = {
      width: size,
      height: size,
      data: new Uint8Array(size * size * 4),

      // When the layer is added to the map,
      // get the rendering context for the map canvas.
      onAdd: function () {
        const canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        this.context = canvas.getContext("2d");
      },

      // Call once before every frame where the icon will be used.
      render: function () {
        const duration = 1000;
        const t = (performance.now() % duration) / duration;

        const radius = (size / 2) * 0.3;
        const outerRadius = (size / 2) * 0.7 * t + radius;
        const context = this.context;

        // Draw the outer circle.
        context.clearRect(0, 0, this.width, this.height);
        context.beginPath();
        context.arc(
          this.width / 2,
          this.height / 2,
          outerRadius,
          0,
          Math.PI * 2
        );
        context.fillStyle = `rgba(255, 200, 200, ${1 - t})`;
        context.fill();

        // Draw the inner circle.
        context.beginPath();
        context.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
        context.fillStyle = "rgba(255, 100, 100, 1)";
        context.strokeStyle = "white";
        context.lineWidth = 2 + 4 * (1 - t);
        context.fill();
        context.stroke();

        // Update this image's data with data from the canvas.
        this.data = context.getImageData(0, 0, this.width, this.height).data;

        // Continuously repaint the map, resulting
        // in the smooth animation of the dot.
        map.triggerRepaint();

        // Return `true` to let the map know that the image was updated.
        return true;
      }
    };
    async function addImage(svg) {
      const image = await svgToDataUrl(false, svg);
      if (!map.hasImage("truck")) map.addImage("truck", image);
    }
    addImage(<TruckLogo />);
    map.addImage("pulsing-dot", pulsingDot, { pixelRatio: 2 });
  }, [mapRef]);

  const url =
    "https://data.police.uk/api/crimes-street/all-crime?lat=52.629729&lng=-1.131592&date=2019-10";
  const { data, error } = useSwr(url, { fetcher });
  const crimes = data && !error ? data.slice(0, 2000) : [];
  const points = useMemo(
    () =>
      crimes.map((crime) => ({
        type: "Feature",
        properties: {
          cluster: false,
          crimeId: crime.id,
          category: crime.category
        },
        geometry: {
          type: "Point",
          coordinates: [crime.location.longitude, crime.location.latitude]
        }
      })),
    [crimes]
  );

  const bounds = mapRef.current
    ? mapRef.current.getMap().getBounds().toArray().flat()
    : null;

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds,
    zoom: viewport.zoom,
    options: { radius: 50, maxZoom: 20 }
  });
  // Reset the popup state and the selected marker when the popup is closed
  const handlePopupClose = useCallback(() => {
    setPopup(null);
  }, []);

  // Pass data that is needed to display the popup and set that marker as selected
  const handleMarkerClicked = useCallback((marker) => {
    const [longitude, latitude] = marker?.geometry?.coordinates;

    // Clicking on the marker will set where the popup will appears and what it displays
    setPopup({
      latitude,
      longitude,
      ...marker.properties
    });
  }, []);
  const geojsonData = useMemo(
    () => ({ type: "FeatureCollection", features: clusters }),
    [clusters]
  );
  const onClick = useCallback(
    (e) => {
      const { lng: longitude, lat: latitude } = e.lngLat;
      const [clickedCluster] = e.features.filter(
        (x) => x.layer.id === "clusters"
      );
      const [clickedMarker] = e.features.filter((x) => x.layer.id === "marker");
      if (clickedMarker) {
        handleMarkerClicked(clickedMarker);
        return;
      }

      if (clickedCluster?.properties?.cluster_id) {
        const expansionZoom = Math.min(
          supercluster.getClusterExpansionZoom(
            clickedCluster.properties.cluster_id
          ),
          20
        );

        mapRef.current.easeTo({
          center: [longitude, latitude],
          zoom: expansionZoom,
          duration: 1000
        });
        return;
      }
      handlePopupClose();
    },
    [supercluster, mapRef]
  );

  const onMove = useCallback((evt) => {
    setViewport(evt.viewState);
  }, []);

  const ShowHidePopUp = useCallback(
    () =>
      popup && (
        <Popup
          latitude={popup.latitude}
          longitude={popup.longitude}
          closeButton={true}
          closeOnClick={true}
          onClose={handlePopupClose}
          anchor="top"
        >
          <div className="popup">
            <h2>{popup.crimeId}</h2>
            <p>{popup.category}</p>
          </div>
        </Popup>
      ),
    [popup, handlePopupClose]
  );

  console.log(geojsonData);

  return (
    <div className="mapcont">
      <MapProvider>
        <ReactMapGL
          {...viewport}
          initialViewState={initialViewState}
          onClick={onClick}
          id="crimeMap"
          maxZoom={20}
          onLoad={onMapLoad}
          mapStyle="mapbox://styles/mapbox/streets-v9"
          mapboxAccessToken={MAPBOX_TOKEN}
          ref={mapRef}
          onMove={onMove}
          interactiveLayerIds={interactiveLayerIds}
          onViewportChange={setViewport}
        >
          <ShowHidePopUp />
          <NavigationControl position="bottom-right" />
          <Source id="assets-source" type="geojson" data={geojsonData}>
            <Layer {...circleLayer} />
            <Layer {...pointsLayer} />
            <Layer {...markerLayer} />
            <Layer {...violentCrimeLayer} />
          </Source>
          <CustomOverlay supercluster={supercluster} />
        </ReactMapGL>
      </MapProvider>
    </div>
  );
}
