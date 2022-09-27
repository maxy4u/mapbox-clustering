import React, { useState, useRef, useCallback, useMemo } from "react";
import useSwr from "swr";
import ReactMapGL, {
  Marker,
  Layer,
  Source,
  NavigationControl
} from "react-map-gl";
import useSupercluster from "use-supercluster";
import "./App.css";
//import 'mapbox-gl/dist/mapbox-gl.css';
//import 'mapbox-gl/dist/svg/mapboxgl-ctrl-compass.svg';
//import 'mapbox-gl/dist/svg/mapboxgl-ctrl-geolocate.svg';
//import 'mapbox-gl/dist/svg/mapboxgl-ctrl-zoom-in.svg';
//import 'mapbox-gl/dist/svg/mapboxgl-ctrl-zoom-out.svg';

export function createFeature(cluster) {
  const [longitude, latitude] = cluster.geometry.coordinates;
  debugger;
  return {
    type: "Feature",
    properties: {
      id: cluster.id,
      point_count: cluster.properties.point_count,
      PointCount: `${cluster.properties.point_count}`
    },
    geometry: {
      type: "Point",
      coordinates: [longitude, latitude]
    }
  };
}

export function createGeoJson(clusters) {
  const filteredClusters = clusters.filter(
    (cluster) => cluster.properties.cluster
  );
  const features = filteredClusters.map((cluster) => createFeature(cluster));
  return {
    type: "FeatureCollection",
    features
  };
}
const initialViewState = {
  latitude: 40.67,
  longitude: -103.59,
  zoom: 3
};
const interactiveLayerIds = ["clusters"];
const fetcher = (...args) => fetch(...args).then((response) => response.json());
const MAPBOX_TOKEN =
  "pk.eyJ1IjoiZ2F1cmF2a2h1cmFuYSIsImEiOiJjbDg0b21iZzEwOHc3M29wZG4xbmlxNzN2In0.JaDwGU4-nidX9WstOTOQcg";
const circleLayer = {
  id: "clusters",
  type: "circle",
  source: "assets-source",
  sourceId: "assets-source",
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
  layout: {
    "text-field": [
      "format",
      ["upcase", ["get", "PointCount"]],
      {
        "font-scale": 1.0
      }
    ]
    // "text-font": ["sans-serif"]
  }
};
export default function App() {
  const [viewport, setViewport] = useState({
    latitude: 52.6376,
    longitude: -1.135171,
    width: "100vw",
    height: "100vh",
    zoom: 12
  });
  const mapRef = useRef();

  const url =
    "https://data.police.uk/api/crimes-street/all-crime?lat=52.629729&lng=-1.131592&date=2019-10";
  const { data, error } = useSwr(url, { fetcher });
  const crimes = data && !error ? data.slice(0, 2000) : [];
  const points = crimes.map((crime) => ({
    type: "Feature",
    properties: { cluster: false, crimeId: crime.id, category: crime.category },
    geometry: {
      type: "Point",
      coordinates: [
        parseFloat(crime.location.longitude),
        parseFloat(crime.location.latitude)
      ]
    }
  }));

  const bounds = mapRef.current
    ? mapRef.current.getMap().getBounds().toArray().flat()
    : null;

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds,
    zoom: viewport.zoom,
    options: { radius: 75, maxZoom: 20 }
  });
  const geojsonData = useMemo(() => createGeoJson(clusters), [clusters]);
  const onClick = useCallback(
    (e) => {
      debugger;
      let expansionZoom;
      const { lng: longitude, lat: latitude } = e.lngLat;
      const [clickedCluster] = e.features.filter(
        (x) => x.layer.id === "clusters"
      );
      if (clickedCluster?.properties?.id) {
        expansionZoom = Math.min(
          supercluster.getClusterExpansionZoom(clickedCluster.properties.id),
          20
        );
        debugger;
        mapRef.current.easeTo({
          center: [longitude, latitude],
          zoom: expansionZoom,
          duration: 500
        });
      }
    },
    [supercluster]
  );

  const onMove = useCallback((evt) => {
    debugger;
    setViewport(evt.viewState);
  }, []);
  console.log(geojsonData);

  return (
    <div>
      <ReactMapGL
        initialViewState={initialViewState}
        onClick={onClick}
        id="crimeMap"
        {...viewport}
        maxZoom={20}
        mapStyle="mapbox://styles/mapbox/streets-v9"
        mapboxAccessToken={MAPBOX_TOKEN}
        onMove={onMove}
        ref={mapRef}
        interactiveLayerIds={interactiveLayerIds}
      >
        <NavigationControl position="top-left" />
        <Source
          id="assets-source"
          type="geojson"
          data={geojsonData}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          {clusters.map((cluster, index) => {
            const [longitude, latitude] = cluster.geometry.coordinates;
            const { cluster_id, cluster: isCluster } = cluster.properties;

            if (isCluster) {
              return (
                <div
                  key={`cluster-${
                    cluster.properties.crimeId || cluster_id
                  }-${index}`}
                >
                  <Layer
                    key={`circle-${
                      cluster.properties.crimeId || cluster_id
                    }-${index}`}
                    {...circleLayer}
                  />
                  <Layer
                    key={`point-${
                      cluster.properties.crimeId || cluster_id
                    }-${index}`}
                    {...pointsLayer}
                  />
                </div>
              );
            }

            return (
              <Marker
                key={`crime-${cluster.properties.crimeId}-${index}`}
                latitude={latitude}
                longitude={longitude}
              >
                <button className="crime-marker">
                  <img src="/custody.svg" alt="crime doesn't pay" />
                </button>
              </Marker>
            );
          })}
        </Source>
      </ReactMapGL>
    </div>
  );
}
