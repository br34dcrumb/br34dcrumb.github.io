import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import worldData from "../lib/world.json";
import { visitedCountries } from "@/consts";

const GlobeComponent: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const renderGlobe = () => {
      if (!mapContainer.current) return;

      // Clear previous SVG before re-rendering
      d3.select(mapContainer.current).select("svg").remove();

      const width = mapContainer.current.clientWidth;
      const height = Math.min(width, 600);
      const sensitivity = 75;
      const scale = width / 3;

      let projection = d3
        .geoOrthographic()
        .scale(scale)
        .center([0, 0])
        .rotate([0, -30])
        .translate([width / 2, height / 2]);

      const initialScale = projection.scale();
      let pathGenerator = d3.geoPath().projection(projection);

      let svg = d3
        .select(mapContainer.current)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      // Globe background (ocean)
      svg
        .append("circle")
        .attr("fill", "#1c1f22") // dark background
        .attr("stroke", "#000")
        .attr("stroke-width", "0.2")
        .attr("cx", width / 2)
        .attr("cy", height / 2)
        .attr("r", initialScale);

      let map = svg.append("g");

      // Countries
      map
        .append("g")
        .attr("class", "countries")
        .selectAll("path")
        .data(worldData.features)
        .enter()
        .append("path")
        .attr("d", (d: any) => pathGenerator(d as any))
        .attr("fill", (d: { properties: { name: string } }) =>
          visitedCountries.includes(d.properties.name)
            ? "#60a3e6" // visited countries
            : "#a7d3f7" // lighter blue for unvisited
        )
        .style("stroke", "#1c1f22")
        .style("stroke-width", 0.3)
        .style("opacity", 0.95);

      // Rotation animation
      const timer = d3.timer(() => {
        const rotate = projection.rotate();
        const k = sensitivity / projection.scale();
        projection.rotate([rotate[0] - 1 * k, rotate[1]]);
        svg.selectAll("path").attr("d", (d: any) => pathGenerator(d as any));
      }, 200);

      return () => {
        timer.stop();
        svg.remove();
      };
    };

    const cleanup = renderGlobe();
    window.addEventListener("resize", renderGlobe);

    return () => {
      cleanup?.();
      window.removeEventListener("resize", renderGlobe);
    };
  }, []);

  return (
    <div className="flex flex-col text-white justify-center items-center w-full h-full">
      <div className="w-full" ref={mapContainer}></div>
    </div>
  );
};

export default GlobeComponent;
