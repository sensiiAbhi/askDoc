'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Network, GitBranch } from 'lucide-react';

interface MindMapNode {
  topic: string;
  description: string;
  children?: MindMapNode[];
}

interface MindMapProps {
  data: MindMapNode;
  onAskQuestion: (question: string) => void;
}

interface FlattenedNode {
  id: string;
  topic: string;
  description: string;
  level: number;
  parentId?: string;
  x: number;
  y: number;
  side?: 'left' | 'right';
}

export default function MindMap({ data, onAskQuestion }: MindMapProps) {
  const [layout, setLayout] = useState<'tree' | 'radial'>('tree');
  const [selectedNode, setSelectedNode] = useState<FlattenedNode | null>(null);

  const svgWidth = 800;
  const svgHeight = 440;

  // Flatten hierarchy and compute coordinates dynamically based on layout
  const { nodes, connections } = useMemo(() => {
    if (!data) return { nodes: [], connections: [] };

    const flattened: FlattenedNode[] = [];
    const links: Array<{ from: string; to: string }> = [];

    const rootId = 'root';
    const subtopics = data.children || [];

    if (layout === 'tree') {
      // --- HIERARCHICAL CONCEPT TREE LAYOUT (Left-to-Right) ---
      const getLeafCount = (node: MindMapNode): number => {
        if (!node.children || node.children.length === 0) return 1;
        return node.children.reduce((acc, child) => acc + getLeafCount(child), 0);
      };

      const totalLeaves = subtopics.reduce((acc, sub) => acc + getLeafCount(sub), 0) || 1;
      const verticalPadding = 35;
      const availableHeight = svgHeight - verticalPadding * 2;
      const stepY = availableHeight / (totalLeaves > 1 ? totalLeaves - 1 : 1);

      let leafIndex = 0;
      const level1Nodes: Array<{ id: string; node: MindMapNode }> = [];

      // 1. Process Level 2 details (leaves) and space them vertically
      subtopics.forEach((sub, subIdx) => {
        const subId = `sub-${subIdx}`;
        level1Nodes.push({ id: subId, node: sub });

        const details = sub.children || [];
        if (details.length === 0) {
          const nodeY = verticalPadding + leafIndex * stepY;
          flattened.push({
            id: subId,
            topic: sub.topic,
            description: sub.description,
            level: 1,
            parentId: rootId,
            x: 350,
            y: nodeY
          });
          links.push({ from: rootId, to: subId });
          leafIndex++;
        } else {
          details.forEach((det, detIdx) => {
            const detId = `det-${subIdx}-${detIdx}`;
            const nodeY = verticalPadding + leafIndex * stepY;
            flattened.push({
              id: detId,
              topic: det.topic,
              description: det.description,
              level: 2,
              parentId: subId,
              x: 670,
              y: nodeY
            });
            links.push({ from: subId, to: detId });
            leafIndex++;
          });
        }
      });

      // 2. Position Level 1 subtopics based on average y of their children
      level1Nodes.forEach(item => {
        const children = flattened.filter(n => n.parentId === item.id);
        if (children.length > 0) {
          const avgY = children.reduce((acc, c) => acc + c.y, 0) / children.length;
          flattened.push({
            id: item.id,
            topic: item.node.topic,
            description: item.node.description,
            level: 1,
            parentId: rootId,
            x: 350,
            y: avgY
          });
          links.push({ from: rootId, to: item.id });
        }
      });

      // 3. Position Root node at the average y of all subtopics
      const level1Processed = flattened.filter(n => n.parentId === rootId);
      const rootY = level1Processed.length > 0
        ? level1Processed.reduce((acc, c) => acc + c.y, 0) / level1Processed.length
        : svgHeight / 2;

      flattened.push({
        id: rootId,
        topic: data.topic,
        description: data.description,
        level: 0,
        x: 90,
        y: rootY
      });

    } else {
      // --- RADIAL MIND MAP LAYOUT (Center-Outwards) ---
      // Split subtopics: even index -> left side, odd index -> right side
      const leftSubtopics = subtopics.filter((_, idx) => idx % 2 === 0);
      const rightSubtopics = subtopics.filter((_, idx) => idx % 2 !== 0);

      const getLeafCount = (node: MindMapNode): number => {
        if (!node.children || node.children.length === 0) return 1;
        return node.children.reduce((acc, child) => acc + getLeafCount(child), 0);
      };

      const leftLeaves = leftSubtopics.reduce((acc, sub) => acc + getLeafCount(sub), 0) || 1;
      const rightLeaves = rightSubtopics.reduce((acc, sub) => acc + getLeafCount(sub), 0) || 1;

      const verticalPadding = 35;
      const availableHeight = svgHeight - verticalPadding * 2;

      const stepLeftY = availableHeight / (leftLeaves > 1 ? leftLeaves - 1 : 1);
      const stepRightY = availableHeight / (rightLeaves > 1 ? rightLeaves - 1 : 1);

      // 1. Process LEFT side nodes
      let leftLeafIdx = 0;
      const leftLevel1: Array<{ id: string; node: MindMapNode }> = [];

      leftSubtopics.forEach((sub, idx) => {
        const origIdx = subtopics.indexOf(sub);
        const subId = `sub-${origIdx}`;
        leftLevel1.push({ id: subId, node: sub });

        const details = sub.children || [];
        if (details.length === 0) {
          const nodeY = verticalPadding + leftLeafIdx * stepLeftY;
          flattened.push({
            id: subId,
            topic: sub.topic,
            description: sub.description,
            level: 1,
            parentId: rootId,
            x: 245,
            y: nodeY,
            side: 'left'
          });
          links.push({ from: rootId, to: subId });
          leftLeafIdx++;
        } else {
          details.forEach((det, detIdx) => {
            const detId = `det-${origIdx}-${detIdx}`;
            const nodeY = verticalPadding + leftLeafIdx * stepLeftY;
            flattened.push({
              id: detId,
              topic: det.topic,
              description: det.description,
              level: 2,
              parentId: subId,
              x: 75,
              y: nodeY,
              side: 'left'
            });
            links.push({ from: subId, to: detId });
            leftLeafIdx++;
          });
        }
      });

      leftLevel1.forEach(item => {
        const children = flattened.filter(n => n.parentId === item.id);
        if (children.length > 0) {
          const avgY = children.reduce((acc, c) => acc + c.y, 0) / children.length;
          flattened.push({
            id: item.id,
            topic: item.node.topic,
            description: item.node.description,
            level: 1,
            parentId: rootId,
            x: 245,
            y: avgY,
            side: 'left'
          });
          links.push({ from: rootId, to: item.id });
        }
      });

      // 2. Process RIGHT side nodes
      let rightLeafIdx = 0;
      const rightLevel1: Array<{ id: string; node: MindMapNode }> = [];

      rightSubtopics.forEach((sub, idx) => {
        const origIdx = subtopics.indexOf(sub);
        const subId = `sub-${origIdx}`;
        rightLevel1.push({ id: subId, node: sub });

        const details = sub.children || [];
        if (details.length === 0) {
          const nodeY = verticalPadding + rightLeafIdx * stepRightY;
          flattened.push({
            id: subId,
            topic: sub.topic,
            description: sub.description,
            level: 1,
            parentId: rootId,
            x: 555,
            y: nodeY,
            side: 'right'
          });
          links.push({ from: rootId, to: subId });
          rightLeafIdx++;
        } else {
          details.forEach((det, detIdx) => {
            const detId = `det-${origIdx}-${detIdx}`;
            const nodeY = verticalPadding + rightLeafIdx * stepRightY;
            flattened.push({
              id: detId,
              topic: det.topic,
              description: det.description,
              level: 2,
              parentId: subId,
              x: 725,
              y: nodeY,
              side: 'right'
            });
            links.push({ from: subId, to: detId });
            rightLeafIdx++;
          });
        }
      });

      rightLevel1.forEach(item => {
        const children = flattened.filter(n => n.parentId === item.id);
        if (children.length > 0) {
          const avgY = children.reduce((acc, c) => acc + c.y, 0) / children.length;
          flattened.push({
            id: item.id,
            topic: item.node.topic,
            description: item.node.description,
            level: 1,
            parentId: rootId,
            x: 555,
            y: avgY,
            side: 'right'
          });
          links.push({ from: rootId, to: item.id });
        }
      });

      // 3. Position Root in the center of the canvas
      flattened.push({
        id: rootId,
        topic: data.topic,
        description: data.description,
        level: 0,
        x: 400,
        y: svgHeight / 2
      });
    }

    return {
      nodes: flattened,
      connections: links
    };
  }, [data, layout]);

  // Set default selected node
  useEffect(() => {
    if (nodes.length > 0) {
      const rootNode = nodes.find(n => n.id === 'root');
      if (rootNode) setSelectedNode(rootNode);
    }
  }, [nodes]);

  const handleAsk = () => {
    if (!selectedNode) return;
    const query = `Explain this concept from the document in detail: "${selectedNode.topic}". Here is what the document says about it: "${selectedNode.description}"`;
    onAskQuestion(query);
  };

  const getBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const cpX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cpX} ${y1}, ${cpX} ${y2}, ${x2} ${y2}`;
  };

  if (!data) return null;

  return (
    <div className="mindmap-widget large">
      {/* Selector & Actions */}
      <div className="mindmap-controls">
        <span className="controls-label">Layout Mode:</span>
        <div className="toggle-button-group">
          <button 
            className={`toggle-btn ${layout === 'tree' ? 'active' : ''}`}
            onClick={() => setLayout('tree')}
            title="Hierarchical Tree Layout"
          >
            <GitBranch size={14} /> Concept Tree
          </button>
          <button 
            className={`toggle-btn ${layout === 'radial' ? 'active' : ''}`}
            onClick={() => setLayout('radial')}
            title="Double-sided Radial Mind Map"
          >
            <Network size={14} /> Mind Map
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="mindmap-canvas-container large">
        <svg 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
          className="mindmap-svg"
          width="100%"
          height="100%"
        >
          {/* Connections */}
          <g className="connections-group">
            {connections.map((link, idx) => {
              const fromNode = nodes.find(n => n.id === link.from);
              const toNode = nodes.find(n => n.id === link.to);
              if (!fromNode || !toNode) return null;
              
              const isLinkActive = selectedNode?.id === toNode.id || selectedNode?.id === fromNode.id;
              
              return (
                <path
                  key={idx}
                  d={getBezierPath(fromNode.x, fromNode.y, toNode.x, toNode.y)}
                  className={`connection-path ${isLinkActive ? 'active' : ''}`}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g className="nodes-group">
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              
              // Spacing dependent on level
              let rectWidth = 140;
              let rectHeight = 34;
              if (node.level === 0) {
                rectWidth = 135;
                rectHeight = 38;
              } else if (node.level === 2) {
                rectWidth = 120;
                rectHeight = 30;
              }

              const rectX = node.x - rectWidth / 2;
              const rectY = node.y - rectHeight / 2;

              return (
                <g 
                  key={node.id} 
                  className={`mindmap-node level-${node.level} ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedNode(node)}
                >
                  <rect
                    x={rectX}
                    y={rectY}
                    width={rectWidth}
                    height={rectHeight}
                    rx={node.level === 0 ? 12 : 8}
                    className="node-rect"
                  />
                  <text
                    x={node.x}
                    y={node.y}
                    dy=".35em"
                    className="node-text"
                    textAnchor="middle"
                    style={{ fontSize: node.level === 2 ? '0.72rem' : '0.8rem' }}
                  >
                    {node.topic.length > 20 ? `${node.topic.slice(0, 18)}...` : node.topic}
                  </text>
                  <title>{node.topic}</title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Details Box */}
      {selectedNode && (
        <div className="mindmap-details-card">
          <div className="details-header">
            <span className="details-badge">
              {selectedNode.level === 0 ? 'Main Subject' : selectedNode.level === 1 ? 'Subtopic' : 'Key Detail'}
            </span>
            <h4 className="details-title">{selectedNode.topic}</h4>
          </div>
          <p className="details-desc">{selectedNode.description}</p>
          
          <button 
            className="btn-primary" 
            onClick={handleAsk}
            style={{ marginTop: '0.5rem', padding: '0.45rem 1rem', fontSize: '0.8rem', width: 'auto', alignSelf: 'flex-start' }}
          >
            <Sparkles size={14} /> Ask AI about this
          </button>
        </div>
      )}
    </div>
  );
}
