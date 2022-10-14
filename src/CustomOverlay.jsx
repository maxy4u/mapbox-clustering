import React, { memo } from "react";
import { useMap } from "react-map-gl";

function getUniqueFeatures(features, comparatorProperty) {
  const uniqueIds = new Set();

  const uniqueFeatures = [];
  for (const feature of features) {
    const id = feature[comparatorProperty];
    if (!uniqueIds.has(id)) {
      uniqueIds.add(id);
      uniqueFeatures.push(feature);
    }
  }
  console.log("unique cluster Ids", [...uniqueIds]);
  return [uniqueFeatures, uniqueIds];
}
const CustomOverlay = ({ supercluster }) => {
  const { current: map } = useMap();
  const [, ids] = getUniqueFeatures(
    map.queryRenderedFeatures({ layers: ["clusters"] }),
    "id"
  );

  const leaves =
    (ids.size &&
      [...ids].reduce(
        (acc, id) => [...acc, ...supercluster?.getLeaves(id)],
        []
      )) ||
    [];
  // getLeaves only display first 10 points by default use Infinity as second parameter
  console.log(leaves); // show visible points in first cluster

  return (
    <div class="map-overlay">
      <fieldset>
        <input
          id="feature-filter"
          type="text"
          placeholder="Filter results by name"
        />
      </fieldset>
      <div id="feature-listing" class="listing">
        <ul>
          {leaves.map(({ properties: { crimeId } }) => {
            return <li>{crimeId}</li>;
          })}
        </ul>
      </div>
    </div>
  );
};

export default memo(CustomOverlay);
