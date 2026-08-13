import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Network, Search, ArrowLeft } from 'lucide-react';
import { Idea } from '../types';

interface GraphViewProps {
  ideas: Idea[];
  onOpenPreviewModal: (ideaId: string) => void;
  onSelectTag: (tag: string) => void;
  onSwitchTab: (tab: string) => void;
}

export const GraphView: React.FC<GraphViewProps> = ({
  ideas,
  onOpenPreviewModal,
  onSelectTag,
  onSwitchTab,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    if (!svgRef.current || ideas.length === 0) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = 580;

    // Clear previous SVG contents
    d3.select(svgRef.current).selectAll('*').remove();

    const nodes: any[] = [];
    const links: any[] = [];
    const tagSet = new Set<string>();

    const query = filterQuery.trim().toLowerCase();

    ideas.forEach((i) => {
      const titleMatches = !query || i.title.toLowerCase().includes(query);
      const contentMatches = !query || i.content.toLowerCase().includes(query);
      const tagMatches = !query || (i.tags || []).some((t) => t.toLowerCase().includes(query));

      const isMatched = titleMatches || contentMatches || tagMatches;

      nodes.push({
        id: `idea_${i.id}`,
        ideaId: i.id,
        label: i.title,
        type: 'idea',
        importance: i.importance || 1,
        isMatched,
      });

      (i.tags || []).forEach((t) => {
        const tagId = `tag_${t}`;
        if (!tagSet.has(t)) {
          tagSet.add(t);
          nodes.push({
            id: tagId,
            tagName: t,
            label: `#${t}`,
            type: 'tag',
            isMatched: !query || t.toLowerCase().includes(query),
          });
        }
        links.push({
          source: `idea_${i.id}`,
          target: tagId,
        });
      });
    });

    const svg = d3.select(svgRef.current);
    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(90)
      )
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(28));

    // Links
    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#6366f1')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5);

    // Node groups
    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'cursor-pointer')
      .call(
        d3
          .drag<any, any>()
          .on('start', (e, d) => {
            if (!e.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (e, d) => {
            d.fx = e.x;
            d.fy = e.y;
          })
          .on('end', (e, d) => {
            if (!e.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Circle representation
    node
      .append('circle')
      .attr('r', (d: any) => (d.type === 'idea' ? d.importance * 2.5 + 8 : 8))
      .attr('fill', (d: any) =>
        d.type === 'idea' ? (d.isMatched ? '#818cf8' : '#334155') : d.isMatched ? '#f59e0b' : '#475569'
      )
      .attr('stroke', (d: any) => (d.type === 'idea' ? '#c7d2fe' : '#fef3c7'))
      .attr('stroke-width', (d: any) => (d.isMatched ? 2 : 1))
      .attr('opacity', (d: any) => (d.isMatched ? 1 : 0.4));

    // Labels
    node
      .append('text')
      .attr('dx', 14)
      .attr('dy', '.35em')
      .text((d: any) => (d.label.length > 15 ? d.label.substring(0, 15) + '...' : d.label))
      .attr('fill', (d: any) => (d.isMatched ? '#f8fafc' : '#64748b'))
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('font-family', 'Pretendard, sans-serif');

    // Click handler
    node.on('click', (_event: any, d: any) => {
      if (d.type === 'idea') {
        onOpenPreviewModal(d.ideaId);
      } else if (d.type === 'tag') {
        onSelectTag(d.tagName);
        onSwitchTab('preview');
      }
    });

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [ideas, filterQuery, onOpenPreviewModal, onSelectTag, onSwitchTab]);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        
        {/* Header toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-extrabold flex items-center gap-2 text-indigo-300 font-sans">
              <Network className="w-5 h-5 text-indigo-400" />
              옵시디언 2D 신경망 지식 맵
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              노드를 드래그하여 고정하거나 줌/팬 가능. 보라색은 지식 노트, 주황색은 태그를 나타냅니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Filter Input */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="맵 노드 필터..."
                className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 outline-none focus:border-indigo-500 w-full sm:w-48"
              />
            </div>

            <button
              onClick={() => onSwitchTab('preview')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>피드로 돌아가기</span>
            </button>
          </div>
        </div>

        {/* Graph Canvas Container */}
        <div ref={containerRef} className="relative w-full h-[580px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800">
          <svg
            ref={svgRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          ></svg>
        </div>

      </div>
    </div>
  );
};
