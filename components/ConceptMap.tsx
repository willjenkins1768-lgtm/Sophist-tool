"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Subject, DRCMData, RespectId } from "@/lib/types";
import { getDisplayRespect } from "@/lib/types";

const RESPECT_COLORS: Record<RespectId, string> = {
  being: "hsl(220 60% 45%)",
  change: "hsl(25 75% 48%)",
  rest: "hsl(160 45% 42%)",
  same: "hsl(280 50% 52%)",
  different: "hsl(0 55% 50%)",
};

type SubjectNodeData = {
  label: string;
  dominantRespectId?: RespectId;
  dominantPoliticalLabel?: string;
  isSelected: boolean;
};

function buildInitialNodes(
  subjects: Subject[],
  data: DRCMData,
  selectedId: string | null
): Node<SubjectNodeData>[] {
  const gap = 200;
  const startX = 60;
  const startY = 80;
  const nodes: Node<SubjectNodeData>[] = [];
  const hasAssessment = (id: string) =>
    data.assessments.party_positions.some((p) => p.subject_id === id) ||
    data.assessments.dominant_respects.some((d) => d.subject_id === id);
  /** Only show migration-domain subjects (Migration, Small boats). Exclude NHS, Climate, etc. */
  const migrationSubjectIds = new Set(["migration", "small_boats"]);
  const displaySubjects = subjects
    .filter((s) => migrationSubjectIds.has(s.id))
    .filter((s) => !s.parent_id || hasAssessment(s.id));
  const taxonomy = data.taxonomy;
  displaySubjects.forEach((subject, i) => {
    const dominant = data.assessments.dominant_respects.find(
      (d) => d.subject_id === subject.id
    );
    const dominantRespectId = dominant?.dominant.respect_id;
    const dominantPoliticalLabel = dominant
      ? getDisplayRespect(taxonomy, {
          political_respect_id: dominant.dominant_political_respect?.political_respect_id ?? undefined,
          respect_id: dominant.dominant.respect_id,
        }).label
      : undefined;
    const isSelected = selectedId === subject.id;
    const row = Math.floor(i / 2);
    const col = i % 2;
    nodes.push({
      id: subject.id,
      type: "subject",
      position: { x: startX + col * gap, y: startY + row * gap },
      data: {
        label: subject.label,
        dominantRespectId,
        dominantPoliticalLabel,
        isSelected,
      },
    });
  });
  return nodes;
}

function buildInitialEdges(subjects: Subject[]): Edge[] {
  const edges: Edge[] = [];
  subjects.forEach((s) => {
    if (s.parent_id) {
      edges.push({ id: `e-${s.parent_id}-${s.id}`, source: s.parent_id, target: s.id });
    }
  });
  return edges;
}

function SubjectNode({ data, selected }: NodeProps<Node<SubjectNodeData>>) {
  const haloColor = data.dominantRespectId
    ? RESPECT_COLORS[data.dominantRespectId]
    : "hsl(0 0% 70%)";
  const tooltip = data.dominantPoliticalLabel
    ? `Dominant: ${data.dominantPoliticalLabel}`
    : data.dominantRespectId
      ? `Dominant: ${data.dominantRespectId}`
      : undefined;
  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        className={`
          min-w-[140px] rounded-xl border-2 px-4 py-3 text-center text-sm font-medium shadow-md
          transition-all duration-200
          ${selected || data.isSelected ? "scale-105 border-stone-800 shadow-lg" : "border-stone-300 bg-white hover:border-stone-500"}
        `}
        style={{
          boxShadow:
            selected || data.isSelected
              ? `0 4px 14px rgba(0,0,0,0.12), 0 0 0 3px ${haloColor}40`
              : `0 0 0 2px ${haloColor}30`,
        }}
        title={tooltip}
      >
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </>
  );
}

const nodeTypes = { subject: SubjectNode };

export default function ConceptMap({
  data,
  selectedSubjectId,
  onSelectSubject,
}: {
  data: DRCMData;
  selectedSubjectId: string | null;
  onSelectSubject: (id: string | null) => void;
}) {
  const subjects = data.subjects;
  const rootSubjects = subjects.filter((s) => !s.parent_id);
  const initialNodes = buildInitialNodes(subjects, data, selectedSubjectId);
  const initialEdges = buildInitialEdges(subjects);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectSubject(node.id);
    },
    [onSelectSubject]
  );

  const onPaneClick = useCallback(() => {
    onSelectSubject(null);
  }, [onSelectSubject]);

  const nodesWithSelection = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      isSelected: selectedSubjectId === n.id,
    },
  }));

  return (
    <div className="h-full w-full rounded-lg border border-stone-300 bg-stone-50">
      <ReactFlow
        nodes={nodesWithSelection}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} color="hsl(0 0% 85%)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
