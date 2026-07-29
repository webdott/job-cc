import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  INACTIVE_STAGE_IDS,
  type Application,
  type ApplicationsResponse,
  type StagesResponse,
} from "./types";

/** All data fetching, mutations, and drag/selection state for the Pipeline board. */
export function usePipelineBoard() {
  const queryClient = useQueryClient();
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [managingStages, setManagingStages] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data, isLoading } = useQuery<ApplicationsResponse>({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await fetch("/api/applications");
      return res.json() as Promise<ApplicationsResponse>;
    },
  });

  const { data: stagesData, isLoading: stagesLoading } = useQuery<StagesResponse>({
    queryKey: ["stages"],
    queryFn: async () => {
      const res = await fetch("/api/stages");
      return res.json() as Promise<StagesResponse>;
    },
  });

  async function handlePullRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["applications"] }),
      queryClient.invalidateQueries({ queryKey: ["stages"] }),
    ]);
  }

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      return res.json();
    },
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["applications"] });
      const prev = queryClient.getQueryData<ApplicationsResponse>(["applications"]);
      queryClient.setQueryData<ApplicationsResponse>(["applications"], (old) => {
        if (!old) return old;
        return {
          applications: old.applications.map((a) => (a.id === id ? { ...a, stage } : a)),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["applications"], context.prev);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/applications/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => fetch(`/api/applications/${id}`, { method: "DELETE" })));
    },
    onSuccess: () => {
      if (selectedAppId && checkedIds.has(selectedAppId)) setSelectedAppId(null);
      setCheckedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const apps = data?.applications ?? [];
  const stages = stagesData?.stages ?? [];
  const restoreStageKey = stages[0]?.key ?? "Applied";

  function getAppsForStage(stageId: string) {
    return apps.filter((a) => a.stage === stageId);
  }

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setCheckedIds((prev) =>
      prev.size === apps.length ? new Set() : new Set(apps.map((a) => a.id))
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const app = apps.find((a) => a.id === event.active.id);
    setActiveApp(app ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveApp(null);
    const { active, over } = event;
    if (!over) return;

    const targetStage = stages.find(
      (s) => s.key === over.id || getAppsForStage(s.key).some((a) => a.id === over.id)
    );
    if (!targetStage) return;

    const draggedApp = apps.find((a) => a.id === active.id);
    if (!draggedApp || draggedApp.stage === targetStage.key) return;

    stageMutation.mutate({ id: draggedApp.id, stage: targetStage.key });
  }

  const totalActive = apps.filter(
    (a) => !["Offer", "Rejected", ...INACTIVE_STAGE_IDS].includes(a.stage)
  ).length;
  const inactiveApps = apps.filter((a) => INACTIVE_STAGE_IDS.includes(a.stage));

  const responseRate =
    apps.length > 0
      ? Math.round(
          (apps.filter((a) => ["Screening", "Interview", "Offer"].includes(a.stage)).length /
            apps.filter((a) => a.stage !== "Saved").length || 0) * 100
        )
      : 0;

  return {
    apps,
    stages,
    isLoading,
    stagesLoading,
    restoreStageKey,
    activeApp,
    selectedAppId,
    setSelectedAppId,
    showInactive,
    setShowInactive,
    checkedIds,
    setCheckedIds,
    managingStages,
    setManagingStages,
    sensors,
    stageMutation,
    deleteMutation,
    bulkDeleteMutation,
    getAppsForStage,
    toggleCheck,
    toggleAll,
    handleDragStart,
    handleDragEnd,
    handlePullRefresh,
    totalActive,
    inactiveApps,
    responseRate,
  };
}
