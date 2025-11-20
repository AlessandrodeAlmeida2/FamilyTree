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
}

export const TreeVisualization = forwardRef<TreeHandle, TreeVisualizationProps>(({
  data,
  rootId,
  generations,
  onSelectPerson
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

    // 1. Build Data (Hourglass: Ancestors + Descendants)
    const ancestorData = buildAncestryTree(rootId, data, 0, generations);
    const descendantData = buildDescendantsTree(rootId, data, 0, generations);

    if (!ancestorData) return;

    const ancestorHierarchy = d3.hierarchy<TreeNodeDatum>(ancestorData);
    const descendantHierarchy = descendantData ? d3.hierarchy<TreeNodeDatum>(descendantData) : null;

    // 2. Setup Tree Layouts
    const nodeWidth = 280; 
    const nodeHeight = 160; 
    
    const treeLayout = d3.tree<TreeNodeDatum>()
      .nodeSize([nodeHeight, nodeWidth])
      .separation((a, b) => a.parent === b.parent ? 1.1 : 1.3);

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
    const initialTransform = d3.zoomIdentity
      .translate(dimensions.width / 2, dimensions.height / 2)
      .scale(0.8);
    svg.call(zoom.transform, initialTransform);

    // Helper to draw nodes and links
    const drawTree = (root: d3.HierarchyPointNode<TreeNodeDatum>, isAncestors: boolean) => {
        // Adjust coordinates: Ancestors go UP (-x), Descendants go DOWN (+x)
        // The root (0,0) is shared.
        // Note: root node is drawn by both, we can skip drawing root in one of them or layer it.
        // We will skip the root rendering in Descendants to avoid duplicate IDs/visuals.
        
        const direction = isAncestors ? -1 : 1;
        
        const nodes = root.descendants();
        const links = root.links();

        // Filter out root for descendants render to avoid double draw
        const nodesToDraw = (!isAncestors && nodes.length > 0) 
             ? nodes.filter(n => n.depth > 0) 
             : nodes;
        
        const linksToDraw = links;

        // Draw Links
        g.selectAll(`.link-${isAncestors ? 'up' : 'down'}`)
          .data(linksToDraw)
          .enter()
          .append("path")
          .attr("class", "link")
          .attr("fill", "none")
          .attr("stroke", "#94a3b8")
          .attr("stroke-width", 1.5)
          .attr("d", (d) => {
              // Custom link generator for inverted Y axis on ancestors
              const s = { y: d.source.x * direction, x: d.source.y };
              const t = { y: d.target.x * direction, x: d.target.y };
              
              return `M${s.x},${s.y}
                      C${(s.x + t.x) / 2},${s.y}
                       ${(s.x + t.x) / 2},${t.y}
                       ${t.x},${t.y}`;
          });

        // Draw Nodes
        const nodeGroup = g.selectAll(`.node-${isAncestors ? 'up' : 'down'}`)
          .data(nodesToDraw)
          .enter()
          .append("g")
          .attr("class", "node cursor-pointer")
          .attr("transform", d => `translate(${d.y},${d.x * direction})`)
          .on("click", (event, d) => {
            event.stopPropagation();
            onSelectPerson(d.data.id);
          });

        renderNodeContent(svg, nodeGroup, rootId);
    };

    drawTree(ancestorRoot, true);
    if (descendantRoot) {
        drawTree(descendantRoot, false);
    }

  }, [data, rootId, dimensions, generations, onSelectPerson]);

  return (
    <div ref={wrapperRef} className="w-full h-full bg-[#f8f9fa] overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none" style={{ 
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', 
            backgroundSize: '24px 24px',
            opacity: 0.4
        }}></div>
        <svg ref={svgRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur shadow-sm border border-gray-200 px-3 py-1.5 rounded-md text-xs text-gray-500 pointer-events-none select-none z-10">
           Exibindo Ancestrais (Cima) e Descendentes (Baixo)
        </div>
    </div>
  );
});

// Extracted rendering logic to reuse for both trees
function renderNodeContent(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, nodeGroup: d3.Selection<SVGGElement, d3.HierarchyPointNode<TreeNodeDatum>, any, any>, rootId: string) {
    // Shadow filter (idempotent check)
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
      .attr("x", -120) // Centered horizontally on the point
      .attr("y", -40) // Centered vertically
      .attr("rx", 8)
      .attr("fill", "white")
      .attr("stroke", d => d.data.data.sex === 'M' ? '#60a5fa' : (d.data.data.sex === 'F' ? '#f472b6' : '#9ca3af'))
      .attr("stroke-width", d => d.data.id === rootId ? 3 : 1)
      .style("filter", "url(#drop-shadow)")
      .on("mouseover", function() {
        d3.select(this).attr("stroke-width", 3).attr("fill", "#f8fafc");
      })
      .on("mouseout", function(e, d) {
        d3.select(this).attr("stroke-width", d.data.id === rootId ? 3 : 1).attr("fill", "white");
      });

    // Image
    nodeGroup.append("circle")
      .attr("r", 26)
      .attr("cx", -85)
      .attr("cy", 0)
      .attr("fill", "#e2e8f0");

    // Create unique clip path ID
    nodeGroup.append("clipPath")
      .attr("id", d => `clip-${d.data.id}-${Math.random().toString(36).substr(2, 9)}`) // Randomize to avoid collision between trees
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
          // Find the previous sibling clipPath ID
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
      
    // Role Label (Contextual)
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
