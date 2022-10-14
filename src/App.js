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
  type: "symbol",
  source: "assets-source",
  sourceId: "assets-source",
  filter: ["!=", "cluster", true],
  layout: {
    "icon-image": "truck", // reference the image
    "icon-size": 1
  }
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
    async function addImage(svg) {
      const image = await svgToDataUrl(false, svg);
      if (!map.hasImage("truck")) map.addImage("truck", image);
    }
    addImage(<TruckLogo />);
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
          </Source>
          <CustomOverlay supercluster={supercluster} />
        </ReactMapGL>
      </MapProvider>
    </div>
  );
}
