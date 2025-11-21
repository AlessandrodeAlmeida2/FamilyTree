import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import { GedcomData, TreeNodeDatum } from '../types';
import { buildAncestryTree, buildDescendantsTree } from '../utils/gedcom';

export interface TreeHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

interface TreeVisualizationProps {
  data: GedcomData;
  rootId: string;
  generations: number;
  onSelectPerson: (id: string) => void;
  highlightedPath?: string[];
}

export const TreeVisualization = forwardRef<TreeHandle, TreeVisualizationProps>(({
  data,
  rootId,
  generations,
  onSelectPerson,
  highlightedPath = []
}, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // References to D3 objects
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const contentGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

  // Expose methods
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (svgSelectionRef.current && zoomBehaviorRef.current) {
        svgSelectionRef.current.transition().duration(500).call(zoomBehaviorRef.current.scaleBy, 1.3);
      }
    },
    zoomOut: () => {
      if (svgSelectionRef.current && zoomBehaviorRef.current) {
        svgSelectionRef.current.transition().duration(500).call(zoomBehaviorRef.current.scaleBy, 1 / 1.3);
      }
    },
    reset: () => {
      if (svgSelectionRef.current && zoomBehaviorRef.current && dimensions.width) {
        const initialTransform = d3.zoomIdentity
          .translate(dimensions.width / 2, dimensions.height / 2) // Center on screen
          .scale(0.8);
        svgSelectionRef.current.transition().duration(750).call(zoomBehaviorRef.current.transform, initialTransform);
      }
    }
  }));

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.offsetWidth,
          height: wrapperRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // D3 Rendering
  useEffect(() => {
    if (!dimensions.width || !dimensions.height || !rootId) return;

    const isMobile = dimensions.width < 768;
    
    // Node Constants
    const CARD_WIDTH = 240;
    const CARD_HEIGHT = 80;
    const HALF_W = CARD_WIDTH / 2;
    const HALF_H = CARD_HEIGHT / 2;

    // 1. Build Data (Hourglass: Ancestors + Descendants)
    const ancestorData = buildAncestryTree(rootId, data, 0, generations);
    const descendantData = buildDescendantsTree(rootId, data, 0, generations);

    if (!ancestorData) return;

    const ancestorHierarchy = d3.hierarchy<TreeNodeDatum>(ancestorData);
    const descendantHierarchy = descendantData ? d3.hierarchy<TreeNodeDatum>(descendantData) : null;

    // 2. Setup Tree Layouts
    const levelSpacing = isMobile ? 150 : 320; // Distance between generations
    const siblingSpacing = isMobile ? 260 : 120; // Distance between siblings
    
    const treeLayout = d3.tree<TreeNodeDatum>()
      .nodeSize(isMobile ? [siblingSpacing, levelSpacing] : [siblingSpacing, levelSpacing])
      .separation((a, b) => a.parent === b.parent ? 1 : 1.1);

    // Calculate layouts
    const ancestorRoot = treeLayout(ancestorHierarchy);
    let descendantRoot = null;
    
    if (descendantHierarchy) {
        descendantRoot = treeLayout(descendantHierarchy);
    }

    // 3. Setup SVG
    const svg = d3.select(svgRef.current);
    svgSelectionRef.current = svg;
    svg.selectAll("*").remove();

    const g = svg.append("g");
    contentGroupRef.current = g;

    // 4. Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    zoomBehaviorRef.current = zoom;
    svg.call(zoom);
    
    // Initial Center
    const initialScale = isMobile ? 0.6 : 0.75;
    const initialTransform = d3.zoomIdentity
      .translate(dimensions.width / 2, dimensions.height / 2)
      .scale(initialScale);
    svg.call(zoom.transform, initialTransform);

    // Helper to draw nodes and links
    const drawTree = (root: d3.HierarchyPointNode<TreeNodeDatum>, isAncestors: boolean) => {
        const nodes = root.descendants();
        const links = root.links();

        // Filter out root for descendants render to avoid double draw
        const nodesToDraw = (!isAncestors && nodes.length > 0) 
             ? nodes.filter(n => n.depth > 0) 
             : nodes;
        
        const linksToDraw = links;

        // Draw Links
        g.selectAll(`.link-${isAncestors ? 'anc' : 'desc'}`)
          .data(linksToDraw)
          .enter()
          .append("path")
          .attr("class", "link")
          .attr("fill", "none")
          .attr("stroke", (d) => {
             // Highlight path logic
             const sourceInPath = highlightedPath.includes(d.source.data.id);
             const targetInPath = highlightedPath.includes(d.target.data.id);
             return (sourceInPath && targetInPath) ? "#f97316" : "#cbd5e1"; // Orange if active, else gray
          })
          .attr("stroke-width", (d) => {
             const sourceInPath = highlightedPath.includes(d.source.data.id);
             const targetInPath = highlightedPath.includes(d.target.data.id);
             return (sourceInPath && targetInPath) ? 3 : 1.5;
          })
          .attr("d", (d) => {
              if (isMobile) {
                  // Vertical Layout Logic 
                  // Ancestors (Up): Link leaves Top (y-40), enters Bottom (y+40)
                  // Descendants (Down): Link leaves Bottom (y+40), enters Top (y-40)
                  
                  // Direction Multiplier for Nodes
                  // Ancestors: Y is negative. Descendants: Y is positive.
                  const dir = isAncestors ? -1 : 1;
                  
                  const sourceX = d.source.x;
                  const sourceYCenter = d.source.y * dir;
                  
                  const targetX = d.target.x;
                  const targetYCenter = d.target.y * dir;

                  // Adjust Start/End points based on Card Height
                  let sY, tY;

                  if (isAncestors) {
                      // Source is "Child" (visually lower), Target is "Parent" (visually higher)
                      // Line: Top of Source -> Bottom of Target
                      sY = sourceYCenter - HALF_H; 
                      tY = targetYCenter + HALF_H; 
                  } else {
                      // Source is "Parent" (visually higher), Target is "Child" (visually lower)
                      // Line: Bottom of Source -> Top of Target
                      sY = sourceYCenter + HALF_H;
                      tY = targetYCenter - HALF_H;
                  }

                  return `M${sourceX},${sY}
                          C${sourceX},${(sY + tY) / 2}
                           ${targetX},${(sY + tY) / 2}
                           ${targetX},${tY}`;
              } else {
                  // Horizontal Layout Logic
                  // Ancestors (Right): X is depth. Y is vertical pos.
                  const dir = isAncestors ? 1 : -1;
                  
                  const sourceY = d.source.x; // Vertical pos
                  const sourceXCenter = d.source.y * dir; // Horizontal pos
                  
                  const targetY = d.target.x;
                  const targetXCenter = d.target.y * dir;

                  let sX, tX;
                  
                  if (isAncestors) {
                      // Source (Left) -> Target (Right)
                      sX = sourceXCenter + HALF_W;
                      tX = targetXCenter - HALF_W;
                  } else {
                      // Source (Right) -> Target (Left)
                      sX = sourceXCenter - HALF_W;
                      tX = targetXCenter + HALF_W;
                  }

                  return `M${sX},${sourceY}
                          C${(sX + tX) / 2},${sourceY}
                           ${(sX + tX) / 2},${targetY}
                           ${tX},${targetY}`;
              }
          });

        // Draw Nodes
        const nodeGroup = g.selectAll(`.node-${isAncestors ? 'anc' : 'desc'}`)
          .data(nodesToDraw)
          .enter()
          .append("g")
          .attr("class", "node cursor-pointer")
          .attr("transform", d => {
             if (isMobile) {
                 const dir = isAncestors ? -1 : 1;
                 return `translate(${d.x},${d.y * dir})`;
             } else {
                 const dir = isAncestors ? 1 : -1;
                 return `translate(${d.y * dir},${d.x})`;
             }
          })
          .on("click", (event, d) => {
            event.stopPropagation();
            onSelectPerson(d.data.id);
          });

        renderNodeContent(svg, nodeGroup, rootId, highlightedPath);
    };

    drawTree(ancestorRoot, true);
    if (descendantRoot) {
        drawTree(descendantRoot, false);
    }

  }, [data, rootId, dimensions, generations, onSelectPerson, highlightedPath]);

  const isMobile = dimensions.width < 768;

  return (
    <div ref={wrapperRef} className="w-full h-full bg-[#f8f9fa] overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none" style={{ 
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', 
            backgroundSize: '24px 24px',
            opacity: 0.4
        }}></div>
        <svg ref={svgRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur shadow-sm border border-gray-200 px-3 py-1.5 rounded-md text-xs text-gray-500 pointer-events-none select-none z-10">
           {isMobile 
             ? "↑ Antepassados | Descendentes ↓" 
             : "← Descendentes | Antepassados →"}
        </div>
    </div>
  );
});

// Extracted rendering logic to reuse for both trees
function renderNodeContent(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, 
    nodeGroup: d3.Selection<SVGGElement, d3.HierarchyPointNode<TreeNodeDatum>, any, any>, 
    rootId: string,
    highlightedPath: string[]
) {
    // Shadow filter
    if (svg.select("#drop-shadow").empty()) {
        const defs = svg.append("defs");
        const filter = defs.append("filter")
          .attr("id", "drop-shadow")
          .attr("height", "130%");
        filter.append("feGaussianBlur")
          .attr("in", "SourceAlpha")
          .attr("stdDeviation", 3)
          .attr("result", "blur");
        filter.append("feOffset")
          .attr("in", "blur")
          .attr("dx", 2)
          .attr("dy", 3)
          .attr("result", "offsetBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "offsetBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }

    // Card
    nodeGroup.append("rect")
      .attr("width", 240)
      .attr("height", 80)
      .attr("x", -120) // Centered horizontally
      .attr("y", -40) // Centered vertically
      .attr("rx", 8)
      .attr("fill", d => highlightedPath.includes(d.data.id) ? "#fff7ed" : "white") // Highlight bg
      .attr("stroke", d => {
          if (highlightedPath.includes(d.data.id)) return "#f97316"; // Orange highlight
          return d.data.data.sex === 'M' ? '#60a5fa' : (d.data.data.sex === 'F' ? '#f472b6' : '#9ca3af');
      })
      .attr("stroke-width", d => (d.data.id === rootId || highlightedPath.includes(d.data.id)) ? 3 : 1)
      .style("filter", "url(#drop-shadow)")
      .on("mouseover", function(e, d) {
        const isHigh = highlightedPath.includes(d.data.id);
        d3.select(this)
            .attr("stroke-width", 3)
            .attr("fill", isHigh ? "#ffedd5" : "#f8fafc");
      })
      .on("mouseout", function(e, d) {
        const isHigh = highlightedPath.includes(d.data.id);
        d3.select(this)
            .attr("stroke-width", (d.data.id === rootId || isHigh) ? 3 : 1)
            .attr("fill", isHigh ? "#fff7ed" : "white");
      });

    // Image
    nodeGroup.append("circle")
      .attr("r", 26)
      .attr("cx", -85)
      .attr("cy", 0)
      .attr("fill", "#e2e8f0");

    // Create unique clip path ID
    nodeGroup.append("clipPath")
      .attr("id", d => `clip-${d.data.id}-${Math.random().toString(36).substr(2, 9)}`) 
      .append("circle")
      .attr("r", 26)
      .attr("cx", -85)
      .attr("cy", 0);

    nodeGroup.append("image")
      .attr("xlink:href", d => d.data.data.imageUrl || `https://picsum.photos/seed/${d.data.id}/200/200`)
      .attr("width", 52)
      .attr("height", 52)
      .attr("x", -111)
      .attr("y", -26)
      .attr("clip-path", function() { 
          const prev = this.previousSibling as Element;
          return `url(#${prev.id})`; 
      })
      .attr("preserveAspectRatio", "xMidYMid slice");

    // Name
    nodeGroup.append("text")
      .attr("x", -50)
      .attr("y", -8)
      .text(d => {
         const full = d.data.name;
         return full.length > 18 ? full.substring(0, 17) + '...' : full;
      })
      .attr("font-size", "14px")
      .attr("font-weight", "600")
      .attr("fill", "#1e293b")
      .style("font-family", "'Inter', sans-serif");

    // Dates
    nodeGroup.append("text")
      .attr("x", -50)
      .attr("y", 10)
      .text(d => {
         const b = d.data.data.birth?.date?.split(' ').pop() || '?';
         const dDate = d.data.data.death?.date?.split(' ').pop();
         const isDead = !!d.data.data.death;
         return `${b} – ${dDate || (isDead ? '?' : 'Pres.')}`;
      })
      .attr("font-size", "12px")
      .attr("fill", "#64748b")
      .style("font-family", "'Inter', sans-serif");
      
    // Role Label
    nodeGroup.append("text")
      .attr("x", -50)
      .attr("y", 26)
      .text(d => {
          if (d.data.id === rootId) return "Pessoa Principal";
          return d.data.data.birth?.place?.split(',')[0] || "";
      })
      .attr("font-size", "10px")
      .attr("fill", "#94a3b8")
      .attr("font-style", "italic")
      .style("font-family", "'Inter', sans-serif");
}

TreeVisualization.displayName = "TreeVisualization";