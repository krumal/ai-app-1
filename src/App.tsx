import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  createLabel,
  createTask,
  deleteProject,
  fetchBoard,
  fetchConfig,
  fetchFile,
  generateDigest,
  generateEstimate,
  pickProject,
  previewDigest,
  selectProject,
  setCardLabels,
  updateFile,
} from "./api";
import {
  calculateBoardTotals,
  cardMatchesQuery,
  getDigestPeriod,
  getNextFolderName,
  getWeekRange,
  hasValidDigestPeriod,
  summarizeCardFiles,
  type BoardTotals,
  type DigestRangePreset,
} from "./appUtils";
import { CardModal } from "./components/CardModal";
import { DateLine, DateText } from "./components/DateText";
import {
  LABEL_COLORS,
  LabelChip,
  LabelChips,
  LabelMenu,
} from "./components/LabelControls";
import type {
  BoardLabel,
  BoardCard,
  BoardList,
  BoardResponse,
  ConfigResponse,
  CreateTaskInput,
  DigestCardPreview,
  DigestPeriod,
  DigestPreviewResponse,
  FileContentResponse,
  GenerateDigestResponse,
  LabelColor,
  ProjectSummary,
} from "../shared/types";

type EstimateActionState = {
  loading: boolean;
  error: string | null;
};

type FileSelectionState = Record<
  string,
  {
    loading: boolean;
    filePath: string | null;
    payload: FileContentResponse | null;
    error: string | null;
  }
>;

type CreateTaskDraftFile = {
  id: string;
  name: string;
  content: string;
};

const EMPTY_FILE_STATE = {
  loading: false,
  filePath: null,
  payload: null,
  error: null,
};


export default function App() {
  const [configState, setConfigState] = useState<{
    loading: boolean;
    error: string | null;
    data: ConfigResponse | null;
  }>({
    loading: true,
    error: null,
    data: null,
  });
  const [boardState, setBoardState] = useState<{
    loading: boolean;
    error: string | null;
    data: BoardResponse | null;
  }>({
    loading: false,
    error: null,
    data: null,
  });
  const [fileState, setFileState] = useState<FileSelectionState>({});
  const [boardQuery, setBoardQuery] = useState("");
  const [activeListFilter, setActiveListFilter] = useState<string>("all");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [createTaskList, setCreateTaskList] = useState<BoardList | null>(null);
  const [activeLabelMenuId, setActiveLabelMenuId] = useState<string | null>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showLabelsPopover, setShowLabelsPopover] = useState(false);
  const [labelMutationState, setLabelMutationState] = useState<{
    cardId: string | null;
    loading: boolean;
    error: string | null;
  }>({
    cardId: null,
    loading: false,
    error: null,
  });
  const [labelFormState, setLabelFormState] = useState<{
    name: string;
    color: LabelColor;
    loading: boolean;
    error: string | null;
  }>({
    name: "",
    color: "blue",
    loading: false,
    error: null,
  });
  const [projectPickerState, setProjectPickerState] = useState({
    loading: false,
    error: null as string | null,
  });
  const [createTaskState, setCreateTaskState] = useState({
    loading: false,
    error: null as string | null,
  });
  const [digestModalOpen, setDigestModalOpen] = useState(false);
  const [digestPreset, setDigestPreset] = useState<DigestRangePreset>("current-week");
  const [digestCustomRange, setDigestCustomRange] = useState<DigestPeriod>(() =>
    getWeekRange(new Date(), 0),
  );
  const [digestPreviewState, setDigestPreviewState] = useState<{
    loading: boolean;
    error: string | null;
    data: DigestPreviewResponse | null;
  }>({
    loading: false,
    error: null,
    data: null,
  });
  const [digestGenerateState, setDigestGenerateState] = useState<{
    loading: boolean;
    error: string | null;
    data: GenerateDigestResponse | null;
  }>({
    loading: false,
    error: null,
    data: null,
  });
  const [estimateActionState, setEstimateActionState] = useState<EstimateActionState>({
    loading: false,
    error: null,
  });
  const [estimateLogOpen, setEstimateLogOpen] = useState(false);

  const activeProjectId = configState.data?.config.activeProjectId ?? null;
  const activeProject = useMemo(
    () => configState.data?.projects.find((project) => project.id === activeProjectId) ?? null,
    [configState.data, activeProjectId],
  );

  const boardLists = boardState.data?.board.lists ?? [];
  const boardLabels = boardState.data?.board.labels ?? [];
  const digestPeriod = useMemo(
    () => getDigestPeriod(digestPreset, digestCustomRange),
    [digestCustomRange, digestPreset],
  );
  const highlightedDigestCardIds = useMemo(
    () =>
      digestModalOpen
        ? new Set(digestPreviewState.data?.cards.map((card) => card.id) ?? [])
        : new Set<string>(),
    [digestModalOpen, digestPreviewState.data],
  );

  const boardTotals = useMemo<BoardTotals>(() => calculateBoardTotals(boardLists), [boardLists]);

  const availableFilters = useMemo(
    () => ["all", ...boardLists.map((list) => list.id)],
    [boardLists],
  );

  const filteredLists = useMemo(() => {
    const normalizedQuery = boardQuery.trim().toLowerCase();

    return boardLists
      .filter((list) => activeListFilter === "all" || list.id === activeListFilter)
      .map((list) => {
        if (!normalizedQuery) {
          return list;
        }

        const listMatches =
          list.title.toLowerCase().includes(normalizedQuery) ||
          list.sourceName.toLowerCase().includes(normalizedQuery);

        if (listMatches) {
          return list;
        }

        return {
          ...list,
          cards: list.cards.filter((card) => cardMatchesQuery(card, normalizedQuery)),
        };
      })
      .filter((list) => list.cards.length > 0);
  }, [activeListFilter, boardLists, boardQuery]);

  const filteredTotals = useMemo<BoardTotals>(
    () => calculateBoardTotals(filteredLists),
    [filteredLists],
  );

  const activeCard = useMemo(() => {
    if (!activeCardId) {
      return null;
    }

    for (const list of boardLists) {
      const card = list.cards.find((candidate) => candidate.id === activeCardId);
      if (card) {
        return {
          list,
          card,
        };
      }
    }

    return null;
  }, [activeCardId, boardLists]);

  useEffect(() => {
    void loadConfig();
  }, []);

  useEffect(() => {
    if (!activeProjectId) {
      setBoardState({
        loading: false,
        error: null,
        data: null,
      });
      setActiveLabelMenuId(null);
      return;
    }

    void loadBoard(activeProjectId);
  }, [activeProjectId]);

  useEffect(() => {
    if (!availableFilters.includes(activeListFilter)) {
      setActiveListFilter("all");
    }
  }, [activeListFilter, availableFilters]);

  useEffect(() => {
    if (!boardState.loading && !activeCard && activeCardId) {
      setActiveCardId(null);
    }
  }, [activeCard, activeCardId, boardState.loading]);

  useEffect(() => {
    setEstimateActionState({
      loading: false,
      error: null,
    });
    setEstimateLogOpen(false);
  }, [activeCardId]);

  useEffect(() => {
    if (!digestModalOpen || !activeProject || !hasValidDigestPeriod(digestPeriod)) {
      setDigestPreviewState({
        loading: false,
        error: null,
        data: null,
      });
      return;
    }

    let canceled = false;
    setDigestPreviewState({
      loading: true,
      error: null,
      data: null,
    });
    setDigestGenerateState({
      loading: false,
      error: null,
      data: null,
    });

    previewDigest(activeProject.id, digestPeriod)
      .then((data) => {
        if (!canceled) {
          setDigestPreviewState({
            loading: false,
            error: null,
            data,
          });
        }
      })
      .catch((error) => {
        if (!canceled) {
          setDigestPreviewState({
            loading: false,
            error: error instanceof Error ? error.message : "Could not preview digest.",
            data: null,
          });
        }
      });

    return () => {
      canceled = true;
    };
  }, [activeProject, digestModalOpen, digestPeriod]);

  useEffect(() => {
    if (!activeCard) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveCardId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeCard]);

  async function loadConfig() {
    try {
      const data = await fetchConfig();
      setConfigState({
        loading: false,
        error: null,
        data,
      });
    } catch (error) {
      setConfigState({
        loading: false,
        error: error instanceof Error ? error.message : "Could not load config.",
        data: null,
      });
    }
  }

  async function loadBoard(projectId: string) {
    setBoardState({
      loading: true,
      error: null,
      data: null,
    });
    setFileState({});
    setActiveLabelMenuId(null);

    try {
      const data = await fetchBoard(projectId);
      setBoardState({
        loading: false,
        error: null,
        data,
      });
    } catch (error) {
      setBoardState({
        loading: false,
        error: error instanceof Error ? error.message : "Could not load board.",
        data: null,
      });
    }
  }

  async function handleProjectPick() {
    setProjectPickerState({
      loading: true,
      error: null,
    });

    try {
      const data = await pickProject();
      if (!data) {
        setProjectPickerState({
          loading: false,
          error: null,
        });
        return;
      }

      setConfigState({
        loading: false,
        error: null,
        data,
      });
      setBoardQuery("");
      setActiveListFilter("all");
      setActiveCardId(null);
      setActiveLabelMenuId(null);
      setProjectPickerState({
        loading: false,
        error: null,
      });
    } catch (error) {
      setProjectPickerState({
        loading: false,
        error: error instanceof Error ? error.message : "Could not pick a project.",
      });
    }
  }

  async function handleProjectSelect(projectId: string) {
    setShowProjectDropdown(false);
    setShowLabelsPopover(false);
    try {
      const data = await selectProject(projectId);
      setConfigState({
        loading: false,
        error: null,
        data,
      });
      setBoardQuery("");
      setActiveListFilter("all");
      setActiveCardId(null);
      setActiveLabelMenuId(null);
    } catch (error) {
      setConfigState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Could not switch project.",
      }));
    }
  }

  async function handleProjectDelete(projectId: string) {
    setShowLabelsPopover(false);
    try {
      const data = await deleteProject(projectId);
      setConfigState({
        loading: false,
        error: null,
        data,
      });
      setBoardQuery("");
      setActiveListFilter("all");
      setActiveCardId(null);
      setActiveLabelMenuId(null);
    } catch (error) {
      setConfigState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Could not delete project.",
      }));
    }
  }

  async function handleFileOpen(cardId: string, projectId: string, relativePath: string) {
    setFileState((current) => ({
      ...current,
      [cardId]: {
        loading: true,
        filePath: relativePath,
        payload: current[cardId]?.payload ?? null,
        error: null,
      },
    }));

    try {
      const payload = await fetchFile(projectId, relativePath);
      setFileState((current) => ({
        ...current,
        [cardId]: {
          loading: false,
          filePath: relativePath,
          payload,
          error: null,
        },
      }));
    } catch (error) {
      setFileState((current) => ({
        ...current,
        [cardId]: {
          loading: false,
          filePath: relativePath,
          payload: null,
          error: error instanceof Error ? error.message : "Could not open file.",
        },
      }));
    }
  }

  async function handleFileSave(cardId: string, projectId: string, relativePath: string, newContent: string) {
    setFileState((current) => ({
      ...current,
      [cardId]: {
        ...current[cardId]!,
        loading: true,
        error: null,
      },
    }));

    try {
      const result = await updateFile(projectId, relativePath, newContent);
      setFileState((current) => ({
        ...current,
        [cardId]: {
          loading: false,
          filePath: relativePath,
          payload: result.file,
          error: null,
        },
      }));
      setBoardState({
        loading: false,
        error: null,
        data: result.board,
      });
    } catch (error) {
      setFileState((current) => ({
        ...current,
        [cardId]: {
          ...current[cardId]!,
          loading: false,
          error: error instanceof Error ? error.message : "Could not save file.",
        },
      }));
      throw error;
    }
  }

  function handleRealtimeFileUpdated(
    cardId: string,
    relativePath: string,
    file: FileContentResponse,
    board: BoardResponse,
  ) {
    setBoardState({
      loading: false,
      error: null,
      data: board,
    });
    setFileState((current) => {
      const cardFileState = current[cardId];
      if (!cardFileState || cardFileState.filePath !== relativePath) {
        return current;
      }

      return {
        ...current,
        [cardId]: {
          loading: false,
          filePath: relativePath,
          payload: file,
          error: null,
        },
      };
    });
  }

  function handleRealtimeFileDeleted(
    cardId: string,
    relativePath: string,
    board: BoardResponse | null,
  ) {
    if (board) {
      setBoardState({
        loading: false,
        error: null,
        data: board,
      });
    }

    setFileState((current) => {
      const cardFileState = current[cardId];
      if (!cardFileState || cardFileState.filePath !== relativePath) {
        return current;
      }

      return {
        ...current,
        [cardId]: {
          loading: false,
          filePath: relativePath,
          payload: null,
          error: `File was deleted or is unreadable: ${relativePath}`,
        },
      };
    });
  }

  function handleRealtimeFileError(cardId: string, relativePath: string, message: string) {
    setFileState((current) => {
      const cardFileState = current[cardId];
      if (!cardFileState || cardFileState.filePath !== relativePath) {
        return current;
      }

      return {
        ...current,
        [cardId]: {
          ...cardFileState,
          loading: false,
          error: message,
        },
      };
    });
  }

  async function handleCardOpen(card: BoardCard) {
    setEstimateActionState({
      loading: false,
      error: null,
    });
    setEstimateLogOpen(false);
    setActiveCardId(card.id);

    const current = fileState[card.id];
    if (!card.defaultOpenFilePath) {
      return;
    }

    if (current?.filePath === card.defaultOpenFilePath && current.payload) {
      return;
    }

    await handleFileOpen(card.id, activeProjectId!, card.defaultOpenFilePath);
  }

  async function handleLabelCreate() {
    if (!activeProject) {
      return;
    }

    setLabelFormState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      await createLabel(activeProject.id, {
        name: labelFormState.name,
        color: labelFormState.color,
      });
      setLabelFormState({
        name: "",
        color: "blue",
        loading: false,
        error: null,
      });
      await loadBoard(activeProject.id);
    } catch (error) {
      setLabelFormState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Could not create label.",
      }));
    }
  }

  async function handleCardLabelsChange(card: BoardCard, labelIds: string[]) {
    if (!activeProject) {
      return;
    }

    setLabelMutationState({
      cardId: card.id,
      loading: true,
      error: null,
    });

    try {
      const data = await setCardLabels(activeProject.id, {
        cardRelativePath: card.relativePath,
        labelIds,
      });

      setBoardState({
        loading: false,
        error: null,
        data,
      });
      setLabelMutationState({
        cardId: null,
        loading: false,
        error: null,
      });

      const openFile = fileState[card.id]?.filePath;
      if (openFile && openFile === card.defaultOpenFilePath) {
        await handleFileOpen(card.id, activeProject.id, openFile);
      }
    } catch (error) {
      setLabelMutationState({
        cardId: card.id,
        loading: false,
        error: error instanceof Error ? error.message : "Could not update labels.",
      });
    }
  }

  async function handleTaskCreate(input: CreateTaskInput) {
    if (!activeProject) {
      return;
    }

    setCreateTaskState({
      loading: true,
      error: null,
    });

    try {
      const data = await createTask(activeProject.id, input);
      setBoardState({
        loading: false,
        error: null,
        data,
      });
      setCreateTaskState({
        loading: false,
        error: null,
      });
      setCreateTaskList(null);
    } catch (error) {
      setCreateTaskState({
        loading: false,
        error: error instanceof Error ? error.message : "Could not create task.",
      });
    }
  }

  async function handleDigestGenerate() {
    if (!activeProject || !hasValidDigestPeriod(digestPeriod)) {
      return;
    }

    setDigestGenerateState({
      loading: true,
      error: null,
      data: null,
    });

    try {
      const data = await generateDigest(activeProject.id, digestPeriod);
      setDigestGenerateState({
        loading: false,
        error: null,
        data,
      });
    } catch (error) {
      setDigestGenerateState({
        loading: false,
        error: error instanceof Error ? error.message : "Could not generate digest.",
        data: null,
      });
    }
  }

  async function handleEstimateGenerate(card: BoardCard) {
    if (!activeProject || !card.estimateEligible) {
      return;
    }

    setEstimateActionState({
      loading: true,
      error: null,
    });

    try {
      const result = await generateEstimate(activeProject.id, {
        cardRelativePath: card.relativePath,
      });
      setBoardState({
        loading: false,
        error: null,
        data: result.board,
      });
      setEstimateActionState({
        loading: false,
        error: null,
      });
      setEstimateLogOpen(true);
    } catch (error) {
      setEstimateActionState({
        loading: false,
        error: error instanceof Error ? error.message : "Could not generate estimate.",
      });
    }
  }

  const hasBoard = Boolean(activeProject && boardState.data && boardState.data.board.taskRootExists);
  const hasVisibleLists = filteredLists.length > 0;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar__left">
          <span className="top-bar__logo">T</span>
          <ProjectDropdown
            projects={configState.data?.projects ?? []}
            activeProjectId={activeProjectId}
            activeProjectName={activeProject?.name ?? null}
            open={showProjectDropdown}
            onToggle={() => setShowProjectDropdown((v) => !v)}
            onClose={() => setShowProjectDropdown(false)}
            onDelete={handleProjectDelete}
            onSelect={handleProjectSelect}
          />
        </div>

        <div className="top-bar__center">
          <div className="top-bar__search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="search"
              value={boardQuery}
              onChange={(event) => setBoardQuery(event.target.value)}
              placeholder="Search cards..."
            />
          </div>
          <div className="top-bar__filters">
            {availableFilters.map((filterId) => {
              const active = filterId === activeListFilter;
              const label =
                filterId === "all"
                  ? "All"
                  : boardLists.find((list) => list.id === filterId)?.title ?? filterId;

              return (
                <button
                  key={filterId}
                  aria-pressed={active}
                  className={`filter-pill ${active ? "is-active" : ""}`}
                  onClick={() => setActiveListFilter(filterId)}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="top-bar__right">
          <button
            className="top-bar__btn top-bar__btn--text"
            disabled={!activeProject || !boardState.data?.board.taskRootExists}
            onClick={() => setDigestModalOpen(true)}
            type="button"
            title="AI digest"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.7 5.2L19 10l-5.3 1.8L12 17l-1.7-5.2L5 10l5.3-1.8L12 3Z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></svg>
            <span>AI Digest</span>
          </button>
          <LabelsPopover
            disabled={!activeProject || !boardState.data?.board.taskRootExists}
            formState={labelFormState}
            labels={boardLabels}
            open={showLabelsPopover}
            onCreate={() => void handleLabelCreate()}
            onFormChange={setLabelFormState}
            onToggle={() => setShowLabelsPopover((value) => !value)}
            onClose={() => setShowLabelsPopover(false)}
          />
          <span className="top-bar__stats">
            {filteredTotals.lists}L / {filteredTotals.cards}C
          </span>
          <button
            className="top-bar__btn"
            disabled={!activeProject || boardState.loading}
            onClick={() => activeProject && void loadBoard(activeProject.id)}
            type="button"
            title="Reload board"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
          </button>
          <button
            className="top-bar__btn top-bar__btn--accent"
            disabled={projectPickerState.loading}
            onClick={() => void handleProjectPick()}
            type="button"
            title={projectPickerState.loading ? "Opening folder picker..." : "Add project"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      </header>

      <main className="board-area">
        {configState.error ? (
          <EmptyState title="Config error" text={configState.error} tone="error" />
        ) : null}

        {projectPickerState.error ? (
          <EmptyState
            title="Project picker failed"
            text={projectPickerState.error}
            tone="error"
          />
        ) : null}

        {!activeProject && !configState.loading ? (
          <EmptyState
            title="No project selected"
            text="Click the project dropdown or + button to get started."
          />
        ) : null}

        {activeProject && boardState.loading ? (
          <EmptyState
            title="Loading board..."
            text="Scanning the local filesystem."
          />
        ) : null}

        {activeProject && boardState.error ? (
          <EmptyState title="Board failed to load" text={boardState.error} tone="error" />
        ) : null}

        {activeProject && boardState.data && !boardState.data.board.taskRootExists ? (
          <EmptyState
            title="No .tasks folder"
            text={`Create ${boardState.data.board.taskRootPath} in the repo and reload.`}
          />
        ) : null}

        {hasBoard && boardTotals.cards === 0 ? (
          <EmptyState
            title="Empty board"
            text="No task folders or markdown files yet."
          />
        ) : null}

        {hasBoard && boardTotals.cards > 0 && !hasVisibleLists ? (
          <EmptyState
            title="No matches"
            text="Try another search or switch to All."
          />
        ) : null}

        {hasBoard && hasVisibleLists ? (
          <section className="board-grid">
            {filteredLists.map((list, index) => (
              <BoardColumn
                activeLabelMenuId={activeLabelMenuId}
                availableLabels={boardLabels}
                key={list.id}
                delayIndex={index}
                list={list}
                labelError={labelMutationState.error}
                labelErrorCardId={labelMutationState.cardId}
                labelLoadingCardId={
                  labelMutationState.loading ? labelMutationState.cardId : null
                }
                highlightedCardIds={highlightedDigestCardIds}
                onCardOpen={handleCardOpen}
                onLabelMenuToggle={(menuId) =>
                  setActiveLabelMenuId((current) => (current === menuId ? null : menuId))
                }
                onLabelsChange={handleCardLabelsChange}
                onTaskCreate={(list) => {
                  setCreateTaskState({ loading: false, error: null });
                  setCreateTaskList(list);
                }}
              />
            ))}
          </section>
        ) : null}

        {activeProject && createTaskList ? (
          <CreateTaskModal
            defaultFolderName={getNextFolderName(createTaskList, boardLists)}
            error={createTaskState.error}
            list={createTaskList}
            loading={createTaskState.loading}
            onClose={() => setCreateTaskList(null)}
            onCreate={(input) => void handleTaskCreate(input)}
          />
        ) : null}

        {activeProject && digestModalOpen ? (
          <DigestModal
            generateState={digestGenerateState}
            period={digestPeriod}
            preset={digestPreset}
            previewState={digestPreviewState}
            customRange={digestCustomRange}
            onClose={() => setDigestModalOpen(false)}
            onCustomRangeChange={setDigestCustomRange}
            onGenerate={() => void handleDigestGenerate()}
            onPresetChange={setDigestPreset}
          />
        ) : null}

        {activeProject && activeCard ? (
          <CardModal
            card={activeCard.card}
            activeLabelMenuId={activeLabelMenuId}
            availableLabels={boardLabels}
            fileState={fileState[activeCard.card.id] ?? EMPTY_FILE_STATE}
            projectId={activeProject.id}
            estimateActionState={estimateActionState}
            labelError={
              labelMutationState.cardId === activeCard.card.id ? labelMutationState.error : null
            }
            labelLoading={
              labelMutationState.loading && labelMutationState.cardId === activeCard.card.id
            }
            listTitle={activeCard.list.title}
            onClose={() => {
              setActiveCardId(null);
              setEstimateActionState({
                loading: false,
                error: null,
              });
              setEstimateLogOpen(false);
            }}
            onFileOpen={(relativePath) =>
              void handleFileOpen(activeCard.card.id, activeProject.id, relativePath)
            }
            onFileSave={(relativePath, newContent) =>
              handleFileSave(activeCard.card.id, activeProject.id, relativePath, newContent)
            }
            onRealtimeFileUpdated={(relativePath, file, board) =>
              handleRealtimeFileUpdated(activeCard.card.id, relativePath, file, board)
            }
            onRealtimeFileDeleted={(relativePath, board) =>
              handleRealtimeFileDeleted(activeCard.card.id, relativePath, board)
            }
            onRealtimeFileError={(relativePath, message) =>
              handleRealtimeFileError(activeCard.card.id, relativePath, message)
            }
            onEstimate={() => void handleEstimateGenerate(activeCard.card)}
            estimateLogOpen={estimateLogOpen}
            onEstimateLogToggle={setEstimateLogOpen}
            onLabelMenuToggle={(menuId) =>
              setActiveLabelMenuId((current) => (current === menuId ? null : menuId))
            }
            onLabelsChange={(labelIds) => void handleCardLabelsChange(activeCard.card, labelIds)}
          />
        ) : null}
      </main>
    </div>
  );
}

function DigestModal({
  customRange,
  generateState,
  period,
  preset,
  previewState,
  onClose,
  onCustomRangeChange,
  onGenerate,
  onPresetChange,
}: {
  customRange: DigestPeriod;
  generateState: {
    loading: boolean;
    error: string | null;
    data: GenerateDigestResponse | null;
  };
  period: DigestPeriod;
  preset: DigestRangePreset;
  previewState: {
    loading: boolean;
    error: string | null;
    data: DigestPreviewResponse | null;
  };
  onClose: () => void;
  onCustomRangeChange: React.Dispatch<React.SetStateAction<DigestPeriod>>;
  onGenerate: () => void;
  onPresetChange: (preset: DigestRangePreset) => void;
}) {
  const [copied, setCopied] = useState(false);
  const cards = previewState.data?.cards ?? [];
  const canGenerate =
    cards.length > 0 &&
    !previewState.loading &&
    !previewState.error &&
    !generateState.loading &&
    hasValidDigestPeriod(period);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    setCopied(false);
  }, [generateState.data?.digest]);

  async function handleCopy() {
    if (!generateState.data?.digest) {
      return;
    }

    await navigator.clipboard.writeText(generateState.data.digest);
    setCopied(true);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        aria-label="AI digest"
        aria-modal="true"
        className="digest-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="digest-modal__header">
          <div>
            <p className="card-modal__eyebrow">AI digest</p>
            <h3>Weekly summary</h3>
            <p className="digest-modal__period">
              {period.from || "Select start"} - {period.to || "Select end"}
            </p>
          </div>
          <button
            aria-label="Close AI digest"
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div className="digest-modal__body">
          <aside className="digest-sidebar">
            <div className="digest-presets" role="group" aria-label="Digest period">
              <button
                className={`digest-preset ${preset === "current-week" ? "is-active" : ""}`}
                onClick={() => onPresetChange("current-week")}
                type="button"
              >
                Current week
              </button>
              <button
                className={`digest-preset ${preset === "previous-week" ? "is-active" : ""}`}
                onClick={() => onPresetChange("previous-week")}
                type="button"
              >
                Previous week
              </button>
              <button
                className={`digest-preset ${preset === "custom" ? "is-active" : ""}`}
                onClick={() => onPresetChange("custom")}
                type="button"
              >
                Custom
              </button>
            </div>

            <div className="digest-range">
              <label>
                <span>From</span>
                <input
                  disabled={preset !== "custom"}
                  type="date"
                  value={preset === "custom" ? customRange.from : period.from}
                  onChange={(event) =>
                    onCustomRangeChange((current) => ({
                      ...current,
                      from: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>To</span>
                <input
                  disabled={preset !== "custom"}
                  type="date"
                  value={preset === "custom" ? customRange.to : period.to}
                  onChange={(event) =>
                    onCustomRangeChange((current) => ({
                      ...current,
                      to: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="digest-candidates">
              <div className="panel-heading">
                <p className="file-tree__label">Included tasks</p>
                <span>{previewState.loading ? "..." : cards.length}</span>
              </div>

              {previewState.loading ? <p className="muted">Loading candidates...</p> : null}
              {previewState.error ? <p className="error-box">{previewState.error}</p> : null}
              {!previewState.loading && !previewState.error && cards.length === 0 ? (
                <p className="muted">No tasks updated in this period.</p>
              ) : null}

              {cards.length > 0 ? (
                <div className="digest-card-list">
                  {cards.map((card) => (
                    <DigestCardPreviewItem card={card} key={card.id} />
                  ))}
                </div>
              ) : null}
            </div>

            <button
              className="digest-generate"
              disabled={!canGenerate}
              onClick={onGenerate}
              type="button"
            >
              {generateState.loading ? "Generating..." : "Generate digest"}
            </button>
          </aside>

          <section className="digest-result" aria-live="polite">
            <div className="digest-result__header">
              <div>
                <p className="file-tree__label">Digest</p>
                <span>{generateState.data ? "Markdown result" : "Ready after generation"}</span>
              </div>
              <button
                className="digest-copy"
                disabled={!generateState.data?.digest}
                onClick={() => void handleCopy()}
                type="button"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {generateState.loading ? <p className="muted">Generating digest...</p> : null}
            {generateState.error ? <p className="error-box">{generateState.error}</p> : null}

            {generateState.data?.digest ? (
              <div className="markdown-body digest-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {generateState.data.digest}
                </ReactMarkdown>
              </div>
            ) : null}

            {!generateState.loading && !generateState.error && !generateState.data ? (
              <div className="digest-placeholder">
                <p>Preview the included tasks, then generate the digest.</p>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}

function DigestCardPreviewItem({ card }: { card: DigestCardPreview }) {
  return (
    <article className="digest-card-preview">
      <div>
        <strong>{card.title}</strong>
        <span>{card.listTitle}</span>
      </div>
      <LabelChips labels={card.labels} limit={2} />
      <p>
        {card.updatedAt ? <DateText value={card.updatedAt} /> : "No update date"} ·{" "}
        {card.fileCount} files
      </p>
      <small>{card.includedFilePaths.join(", ") || "No files selected"}</small>
    </article>
  );
}

function ProjectDropdown({
  projects,
  activeProjectId,
  activeProjectName,
  open,
  onToggle,
  onClose,
  onDelete,
  onSelect,
}: {
  projects: ProjectSummary[];
  activeProjectId: string | null;
  activeProjectName: string | null;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onDelete: (projectId: string) => Promise<void>;
  onSelect: (projectId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open, onClose]);

  return (
    <div className="project-dropdown" ref={ref}>
      <button className="project-trigger" onClick={onToggle} type="button">
        <span>{activeProjectName ?? "Select project"}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open ? (
        <div className="project-popover">
          {projects.length === 0 ? (
            <p className="project-popover__empty">No projects configured</p>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className={`project-popover__item ${project.id === activeProjectId ? "is-active" : ""}`}
              >
                <button
                  className="project-popover__select"
                  onClick={() => void onSelect(project.id)}
                  type="button"
                >
                  <span className={`project-popover__dot ${project.exists ? "is-ready" : ""}`} />
                  <span className="project-popover__name">{project.name}</span>
                </button>
                <button
                  aria-label={`Delete ${project.name}`}
                  className="project-popover__delete"
                  onClick={() => void onDelete(project.id)}
                  title={`Delete ${project.name}`}
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function LabelsPopover({
  disabled,
  formState,
  labels,
  open,
  onClose,
  onCreate,
  onFormChange,
  onToggle,
}: {
  disabled: boolean;
  formState: {
    name: string;
    color: LabelColor;
    loading: boolean;
    error: string | null;
  };
  labels: BoardLabel[];
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  onFormChange: React.Dispatch<React.SetStateAction<{
    name: string;
    color: LabelColor;
    loading: boolean;
    error: string | null;
  }>>;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const canCreate = formState.name.trim().length > 0 && !formState.loading;

  useEffect(() => {
    if (!open) return;

    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open, onClose]);

  return (
    <div className="labels-popover" ref={ref}>
      <button
        className="labels-trigger"
        disabled={disabled}
        onClick={onToggle}
        title="Board labels"
        type="button"
      >
        <span>Labels</span>
        <small>{labels.length}</small>
      </button>

      {open ? (
        <div className="labels-panel">
          <div className="labels-panel__header">
            <strong>Labels</strong>
            <span>.tasks/labels.json</span>
          </div>

          {labels.length > 0 ? (
            <div className="labels-panel__list">
              {labels.map((label) => (
                <LabelChip key={label.id} label={label} />
              ))}
            </div>
          ) : (
            <p className="labels-panel__empty">No labels yet</p>
          )}

          <form
            className="label-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (canCreate) {
                onCreate();
              }
            }}
          >
            <label className="label-form__field">
              <span>Name</span>
              <input
                autoComplete="off"
                placeholder="Needs review"
                value={formState.name}
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    name: event.target.value,
                    error: null,
                  }))
                }
              />
            </label>

            <div className="label-form__colors" role="radiogroup" aria-label="Label color">
              {LABEL_COLORS.map((color) => (
                <button
                  aria-checked={formState.color === color}
                  aria-label={color}
                  className={`color-swatch ${formState.color === color ? "is-active" : ""}`}
                  data-color={color}
                  key={color}
                  onClick={() =>
                    onFormChange((current) => ({
                      ...current,
                      color,
                      error: null,
                    }))
                  }
                  role="radio"
                  type="button"
                />
              ))}
            </div>

            {formState.error ? <p className="label-form__error">{formState.error}</p> : null}

            <button
              className="label-form__submit"
              disabled={!canCreate}
              type="submit"
            >
              {formState.loading ? "Creating..." : "Create label"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({
  text,
  title,
  tone = "default",
}: {
  text: string;
  title: string;
  tone?: "default" | "error";
}) {
  return (
    <section className={`empty-state ${tone === "error" ? "empty-state--error" : ""}`}>
      <h3>{title}</h3>
      <p>{text}</p>
    </section>
  );
}

function BoardColumn({
  activeLabelMenuId,
  availableLabels,
  delayIndex,
  highlightedCardIds,
  labelError,
  labelErrorCardId,
  labelLoadingCardId,
  list,
  onCardOpen,
  onLabelMenuToggle,
  onLabelsChange,
  onTaskCreate,
}: {
  activeLabelMenuId: string | null;
  availableLabels: BoardLabel[];
  delayIndex: number;
  highlightedCardIds: Set<string>;
  labelError: string | null;
  labelErrorCardId: string | null;
  labelLoadingCardId: string | null;
  list: BoardList;
  onCardOpen: (card: BoardCard) => Promise<void>;
  onLabelMenuToggle: (menuId: string) => void;
  onLabelsChange: (card: BoardCard, labelIds: string[]) => void;
  onTaskCreate: (list: BoardList) => void;
}) {
  return (
    <section
      className="board-column"
      style={{ animationDelay: `${delayIndex * 60}ms` }}
      aria-label={`${list.title} column`}
    >
      <header className="board-column__header">
        <h3>{list.title}</h3>
        <div className="board-column__tools">
          <span className="board-column__count">{list.cards.length}</span>
          <button
            aria-label={`Add task to ${list.title}`}
            className="board-column__add"
            onClick={() => onTaskCreate(list)}
            title="Add task"
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      </header>

      <div className="card-stack">
        {list.cards.map((card) => (
          <TaskCardButton
            activeLabelMenuId={activeLabelMenuId}
            availableLabels={availableLabels}
            key={card.id}
            card={card}
            highlighted={highlightedCardIds.has(card.id)}
            labelError={labelErrorCardId === card.id ? labelError : null}
            labelLoading={labelLoadingCardId === card.id}
            onLabelMenuToggle={onLabelMenuToggle}
            onLabelsChange={(labelIds) => onLabelsChange(card, labelIds)}
            onOpen={() => void onCardOpen(card)}
          />
        ))}
      </div>
    </section>
  );
}

function TaskCardButton({
  activeLabelMenuId,
  availableLabels,
  card,
  highlighted,
  labelError,
  labelLoading,
  onLabelMenuToggle,
  onLabelsChange,
  onOpen,
}: {
  activeLabelMenuId: string | null;
  availableLabels: BoardLabel[];
  card: BoardCard;
  highlighted: boolean;
  labelError: string | null;
  labelLoading: boolean;
  onLabelMenuToggle: (menuId: string) => void;
  onLabelsChange: (labelIds: string[]) => void;
  onOpen: () => void;
}) {
  const summary = summarizeCardFiles(card.files);
  const menuId = `card:${card.id}`;

  return (
    <article
      className={`task-card ${highlighted ? "task-card--digest" : ""}`}
    >
      <button className="task-card__open" onClick={onOpen} type="button">
        <div className="task-card__row">
          <h4>{card.title}</h4>
          {summary.markdownFiles > 0 ? (
            <span className="task-card__badge">{summary.markdownFiles}</span>
          ) : null}
        </div>
        <LabelChips labels={card.labels} limit={3} />
        <CardDateMeta updatedAt={card.updatedAt} />
        <p className="task-card__path">{card.relativePath}</p>
      </button>
      <LabelMenu
        availableLabels={availableLabels}
        error={labelError}
        loading={labelLoading}
        menuId={menuId}
        open={activeLabelMenuId === menuId}
        selectedLabelIds={card.labelIds}
        size="compact"
        onChange={onLabelsChange}
        onToggle={() => onLabelMenuToggle(menuId)}
      />
    </article>
  );
}

function CreateTaskModal({
  defaultFolderName,
  error,
  list,
  loading,
  onClose,
  onCreate,
}: {
  defaultFolderName: string;
  error: string | null;
  list: BoardList;
  loading: boolean;
  onClose: () => void;
  onCreate: (input: CreateTaskInput) => void;
}) {
  const [folderName, setFolderName] = useState(defaultFolderName);
  const [files, setFiles] = useState<CreateTaskDraftFile[]>([]);
  const canCreate =
    folderName.trim().length > 0 &&
    files.length > 0 &&
    files.every((file) => file.name.trim().length > 0) &&
    !loading;
  const createInput = {
    listId: list.id,
    folderName,
    files: files.map(({ name, content }) => ({ name, content })),
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function addFile() {
    setFiles((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "",
        content: "",
      },
    ]);
  }

  function updateFile(fileId: string, patch: Partial<Omit<CreateTaskDraftFile, "id">>) {
    setFiles((current) =>
      current.map((file) => (file.id === fileId ? { ...file, ...patch } : file)),
    );
  }

  function removeFile(fileId: string) {
    setFiles((current) => current.filter((file) => file.id !== fileId));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        aria-label="Create task"
        aria-modal="true"
        className="create-task-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="create-task-modal__header">
          <div>
            <p className="card-modal__eyebrow">{list.title}</p>
            <h3>New task</h3>
          </div>
          <button
            aria-label="Close create task"
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <form
          className="create-task-form"
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.metaKey && canCreate) {
              event.preventDefault();
              onCreate(createInput);
            }
          }}
          onSubmit={(event) => {
            event.preventDefault();
            if (canCreate) {
              onCreate(createInput);
            }
          }}
        >
          <label className="create-task-field">
            <span>Folder</span>
            <input
              autoFocus
              autoComplete="off"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
            />
          </label>

          <div className="create-task-files">
            <div className="panel-heading">
              <p className="file-tree__label">Files</p>
              <button className="create-task-add-file" onClick={addFile} type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>

            {files.length === 0 ? (
              <p className="muted">Add at least one file to create the task folder.</p>
            ) : null}

            {files.map((file, index) => (
              <div className="create-task-file" key={file.id}>
                <div className="create-task-file__top">
                  <label className="create-task-field">
                    <span>File {index + 1}</span>
                    <input
                      autoComplete="off"
                      placeholder="draft.md"
                      value={file.name}
                      onChange={(event) => updateFile(file.id, { name: event.target.value })}
                    />
                  </label>
                  <button
                    aria-label={`Remove file ${index + 1}`}
                    className="create-task-remove-file"
                    onClick={() => removeFile(file.id)}
                    type="button"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                <textarea
                  placeholder="Content"
                  value={file.content}
                  onChange={(event) => updateFile(file.id, { content: event.target.value })}
                />
              </div>
            ))}
          </div>

          {error ? <p className="error-box">{error}</p> : null}

          <div className="create-task-actions">
            <button className="create-task-secondary" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="create-task-submit" disabled={!canCreate} type="submit">
              {loading ? "Creating..." : "Create task"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CardDateMeta({
  updatedAt,
}: {
  updatedAt: string | null;
}) {
  if (!updatedAt) {
    return null;
  }

  return (
    <div className="task-card__dates">
      <DateLine label="Updated" value={updatedAt} />
    </div>
  );
}
