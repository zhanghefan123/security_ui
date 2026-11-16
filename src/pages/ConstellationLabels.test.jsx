import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {ConstellationLabelContext, ConstellationNameLabel} from "./ConstellationLabels";

// Exercise React updates without requiring a WebGL canvas in jsdom.
jest.mock("resium", () => ({
    LabelGraphics: ({text, show}) => <span hidden={!show}>{text}</span>,
}));

test("existing labels follow independent display switches and restored names without a position poll", () => {
    const labels = <>
        <ConstellationNameLabel name="Satellite-1" />
        <ConstellationNameLabel name="GroundStation-2" groundStation runtime />
        <ConstellationNameLabel name="Beijing Station" groundStation />
    </>;
    const scene = (options) => <ConstellationLabelContext.Provider value={{
        showSatelliteNames: true, showGroundStationNames: true, groundStationNames: [], ...options,
    }}>{labels}</ConstellationLabelContext.Provider>;
    const {rerender} = render(scene());
    expect(screen.getByText("Satellite-1")).toBeVisible();
    expect(screen.getByText("GroundStation-2")).toBeVisible();
    expect(screen.getByText("Beijing Station")).toBeVisible();

    rerender(scene({showSatelliteNames: false, groundStationNames: ["Beijing Station", "Svalbard Station"]}));
    expect(screen.getByText("Satellite-1")).not.toBeVisible();
    expect(screen.getByText("Svalbard Station")).toBeVisible();
    expect(screen.queryByText("GroundStation-2")).toBeNull();

    rerender(scene({showGroundStationNames: false}));
    expect(screen.getByText("Satellite-1")).toBeVisible();
    expect(screen.getByText("GroundStation-2")).not.toBeVisible();
    expect(screen.getByText("Beijing Station")).not.toBeVisible();
});

test("unmapped or malformed station identifiers retain a usable name", () => {
    render(<ConstellationLabelContext.Provider value={{
        showSatelliteNames: true, showGroundStationNames: true, groundStationNames: ["Beijing Station"],
    }}>
        <ConstellationNameLabel name="GroundStation-1" groundStation runtime />
        <ConstellationNameLabel name="GroundStation-3" groundStation runtime />
        <ConstellationNameLabel name="GroundStation-0" groundStation runtime />
        <ConstellationNameLabel name="Custom Station" groundStation runtime />
    </ConstellationLabelContext.Provider>);
    for (const name of ["Beijing Station", "GroundStation-3", "GroundStation-0", "Custom Station"]) {
        expect(screen.getByText(name)).toBeVisible();
    }
});
