import React, {useMemo} from "react";
import {Entity, PolylineGraphics} from "resium";
import {ArcType, Cartesian3, Color, PolylineDashMaterialProperty} from "cesium";

const orbitMaterial = new PolylineDashMaterialProperty({
    color: Color.fromCssColorString("#86c5dc").withAlpha(0.65),
    dashLength: 12,
});
const segments = 360;

// The backend generates near-circular orbits, with equally spaced mean anomalies.
// Fit the first spatial harmonic from one complete position snapshot, in the same
// Earth-fixed coordinates as the displayed satellites. This is an instantaneous
// orbit guide, not a future ground track or a replacement for TLE propagation.
function fitOrbit(points) {
    const center = new Cartesian3();
    const cosine = new Cartesian3();
    const sine = new Cartesian3();
    for (let index = 0; index < points.length; index++) {
        const point = points[index];
        const angle = 2 * Math.PI * index / points.length;
        Cartesian3.add(center, point, center);
        Cartesian3.add(cosine, Cartesian3.multiplyByScalar(point, Math.cos(angle), new Cartesian3()), cosine);
        Cartesian3.add(sine, Cartesian3.multiplyByScalar(point, Math.sin(angle), new Cartesian3()), sine);
    }
    Cartesian3.divideByScalar(center, points.length, center);
    Cartesian3.multiplyByScalar(cosine, 2 / points.length, cosine);
    Cartesian3.multiplyByScalar(sine, 2 / points.length, sine);
    const cosineLength = Cartesian3.magnitude(cosine);
    const sineLength = Cartesian3.magnitude(sine);
    const area = Cartesian3.magnitude(Cartesian3.cross(cosine, sine, new Cartesian3()));
    // Reject zero/uninitialised or nearly collinear snapshots instead of drawing
    // a guessed orbital plane. One or two antipodal satellites cannot define it.
    if (cosineLength < 6000000 || sineLength < 6000000 || area / (cosineLength * sineLength) < 0.1) return null;
    const curve = [];
    for (let index = 0; index < segments; index++) {
        const angle = 2 * Math.PI * index / segments;
        curve.push(new Cartesian3(
            center.x + cosine.x * Math.cos(angle) + sine.x * Math.sin(angle),
            center.y + cosine.y * Math.cos(angle) + sine.y * Math.sin(angle),
            center.z + cosine.z * Math.cos(angle) + sine.z * Math.sin(angle),
        ));
    }
    curve.push(Cartesian3.clone(curve[0]));
    return curve;
}

export function ConstellationOrbits({positions, orbitNumber, satellitePerOrbit, show}) {
    const orbits = useMemo(() => {
        if (!show || !Number.isInteger(orbitNumber) || orbitNumber < 1 ||
            !Number.isInteger(satellitePerOrbit) || satellitePerOrbit < 3 ||
            orbitNumber * satellitePerOrbit > 99999) return [];
        const groups = new Map();
        for (const [name, position] of Object.entries(positions)) {
            const match = /^Satellite-([1-9]\d*)$/.exec(name);
            if (!match || position.node_type !== "Satellite") continue;
            const nodeIndex = Number(match[1]) - 1;
            const orbit = Math.floor(nodeIndex / satellitePerOrbit);
            if (orbit >= orbitNumber || ![position.longitude, position.latitude, position.altitude].every(Number.isFinite) ||
                Math.abs(position.longitude) > Math.PI || Math.abs(position.latitude) > Math.PI / 2 || position.altitude <= 0) continue;
            if (!groups.has(orbit)) groups.set(orbit, new Map());
            groups.get(orbit).set(nodeIndex % satellitePerOrbit, Cartesian3.fromRadians(position.longitude, position.latitude, position.altitude));
        }
        const result = [];
        for (const [orbit, members] of groups) {
            if (members.size !== satellitePerOrbit) continue;
            const points = Array.from({length: satellitePerOrbit}, (_, index) => members.get(index));
            const curve = fitOrbit(points);
            if (curve) result.push({orbit, curve});
        }
        return result;
    }, [positions, orbitNumber, satellitePerOrbit, show]);

    return orbits.map(({orbit, curve}) => <Entity key={orbit} id={`orbit-guide:${orbit}`} name={`轨道 ${orbit + 1}（近圆拟合）`}
        description="根据当前卫星位置拟合的完整近圆轨道，仅用于观察构型；虚线不是通信链路，也不是未来地面轨迹。">
        <PolylineGraphics positions={curve} width={1.5} material={orbitMaterial} arcType={ArcType.NONE} clampToGround={false} />
    </Entity>);
}
