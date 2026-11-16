import React, {createContext, useContext} from "react";
import {LabelGraphics} from "resium";
import {Cartesian2, Cartesian3, Color, HorizontalOrigin, LabelStyle, VerticalOrigin} from "cesium";

// Context keeps labels current even when their Entity JSX was stored by an earlier poll.
export const ConstellationLabelContext = createContext({
    showSatelliteNames: true,
    showGroundStationNames: true,
    groundStationNames: [],
});

const pixelOffset = new Cartesian2(12, -16);
const backgroundPadding = new Cartesian2(6, 4);
const backgroundColor = Color.fromCssColorString("#0b1220").withAlpha(0.8);
// Ground station boxes have 100 km sides; move text in front of their bounding sphere.
// Keep depth testing enabled so names on the far side of Earth remain hidden.
const groundStationEyeOffset = new Cartesian3(0, 0, -90000);

export function ConstellationNameLabel({name, groundStation = false, runtime = false}) {
    const {showSatelliteNames, showGroundStationNames, groundStationNames} = useContext(ConstellationLabelContext);
    let text = name;
    if (groundStation && runtime) {
        // Backend numbers stations from 1 in the same order as the selected station list.
        const match = /^GroundStation-([1-9]\d*)$/.exec(name);
        if (match) text = groundStationNames[Number(match[1]) - 1] || name;
    }

    return <LabelGraphics
        text={text}
        show={groundStation ? showGroundStationNames : showSatelliteNames}
        font={'14px "Microsoft YaHei", sans-serif'}
        fillColor={Color.WHITE}
        style={LabelStyle.FILL_AND_OUTLINE}
        outlineColor={Color.BLACK}
        outlineWidth={2}
        showBackground
        backgroundColor={backgroundColor}
        backgroundPadding={backgroundPadding}
        pixelOffset={pixelOffset}
        eyeOffset={groundStation ? groundStationEyeOffset : Cartesian3.ZERO}
        horizontalOrigin={HorizontalOrigin.LEFT}
        verticalOrigin={VerticalOrigin.BOTTOM}
    />;
}
